import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { uploadCertificatePDF } from '../lib/storage.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';
import { randomUUID } from 'crypto';
import { generateEICPDF, EICData } from '../certificates/generators/generate-eic.js';
import { generateMinorWorksPDF, MinorWorksData } from '../certificates/generators/generate-minor-works.js';
import { generateEICRPDF, EICRData } from '../certificates/generators/generate-eicr.js';
import { getTestTemplate } from '../lib/test-templates.js';

const tracer = trace.getTracer('tests-mcp');

interface GenerateCertificateInput {
  test_id: string;
  certificate_type: 'eicr' | 'eic' | 'pat' | 'minor_works';
  issue_date?: string;
  expiry_date?: string;
}

/**
 * Fetch complete test data with all related information
 */
async function fetchCompleteTestData(testId: string, tenantId: string) {
  // Get test with all relationships
  const testResult = await query(
    `SELECT t.*,
            c.name as client_name,
            c.email as client_email,
            c.phone as client_phone,
            s.name as site_name,
            s.address_line1,
            s.address_line2,
            s.city,
            s.county,
            s.postcode,
            s.premises_type
     FROM tests t
     LEFT JOIN clients c ON t.client_id = c.id
     LEFT JOIN sites s ON t.site_id = s.id
     WHERE t.id = $1 AND t.tenant_id = $2`,
    [testId, tenantId]
  );

  if (testResult.rows.length === 0) {
    throw new Error('Test not found');
  }

  const test = testResult.rows[0];

  // Get circuits
  const circuitsResult = await query(
    `SELECT * FROM test_circuits
     WHERE test_id = $1 AND tenant_id = $2
     ORDER BY circuit_reference`,
    [testId, tenantId]
  );

  // Get measurements
  const measurementsResult = await query(
    `SELECT * FROM test_measurements
     WHERE test_id = $1 AND tenant_id = $2
     ORDER BY circuit_ref, measurement_type`,
    [testId, tenantId]
  );

  return {
    test,
    circuits: circuitsResult.rows,
    measurements: measurementsResult.rows
  };
}

/**
 * Generate certificate PDF based on type
 */
export async function generateCertificate(
  input: GenerateCertificateInput,
  context: AuthContext
): Promise<any> {
  return tracer.startActiveSpan('tool.generate_certificate', async (span) => {
    try {
      span.setAttributes({
        'tenant.id': context.tenant_id,
        'test.id': input.test_id,
        'certificate.type': input.certificate_type,
      });

      // Fetch complete test data
      const { test, circuits, measurements } = await fetchCompleteTestData(
        input.test_id,
        context.tenant_id
      );

      if (test.status !== 'completed') {
        throw new Error('Cannot generate certificate for incomplete test');
      }

      // Generate certificate number
      const numberResult = await query(
        `SELECT generate_certificate_number($1, $2) as number`,
        [context.tenant_id, input.certificate_type]
      );
      const certificateNumber = numberResult.rows[0].number;

      const issueDate = input.issue_date || new Date().toISOString().split('T')[0];

      // Get business profile for branding
      // TODO: Fetch from identity-mcp or environment variables
      const businessName = process.env.BUSINESS_NAME || 'JobBuilda Electrical';
      const businessAddress = process.env.BUSINESS_ADDRESS || '123 High Street, London';
      const businessPhone = process.env.BUSINESS_PHONE || '020 1234 5678';
      const businessEmail = process.env.BUSINESS_EMAIL || 'info@jobbuilda.co.uk';
      const businessRegistration = process.env.BUSINESS_REGISTRATION || 'NICEIC 12345';

      // Prepare common data
      const installationDetails = {
        clientName: test.client_name,
        clientEmail: test.client_email,
        clientPhone: test.client_phone,
        siteAddress: `${test.address_line1}${test.address_line2 ? ', ' + test.address_line2 : ''}, ${test.city}`,
        sitePostcode: test.postcode,
        premisesType: test.premises_type || 'domestic',
        installationDescription: test.description,
        scopeOfWork: test.description,
        earthingArrangement: test.earthing_arrangements,
        dateOfInspection: test.test_date || issueDate,
        supplyVoltage: 230,
        supplyFrequency: 50
      };

      const declarations = {
        inspectorName: test.inspector_name || 'Not specified',
        inspectorRegistration: test.inspector_registration_number,
        dateInspected: test.test_date || issueDate,
        nextInspectionDate: test.next_inspection_date,
        nextInspectionMonths: test.premises_type === 'domestic' ? 120 : test.premises_type === 'commercial' ? 60 : 12
      };

      // Transform circuits to test results format
      // Note: numeric columns come back as strings from pg driver — coerce to number
      const circuitTestResults = circuits.map((circuit: any) => ({
        circuitReference: circuit.circuit_reference,
        location: circuit.location || '',
        deviceType: circuit.overcurrent_device_type || '',
        deviceRating: circuit.overcurrent_device_rating || '',
        conductorCSA: circuit.conductor_csa,
        continuityR1R2: circuit.continuity_r1_r2 != null ? parseFloat(circuit.continuity_r1_r2) : undefined,
        insulationResistance: circuit.insulation_resistance != null ? parseFloat(circuit.insulation_resistance) : undefined,
        earthLoopImpedance: circuit.earth_loop_impedance != null ? parseFloat(circuit.earth_loop_impedance) : undefined,
        polarityCorrect: circuit.polarity_correct,
        rcdTripTime: undefined,
        result: circuit.test_result || 'satisfactory'
      }));

      // Get inspection items from template or database
      const template = getTestTemplate(test.test_type, test.premises_type);
      const inspections = test.schedule_of_inspections?.items || template.inspectionItems;

      // Generate PDF based on certificate type
      let pdfBuffer: Buffer;

      if (input.certificate_type === 'eic') {
        const eicData: EICData = {
          certificateNumber,
          issueDate,
          businessName,
          businessAddress,
          businessPhone,
          businessEmail,
          businessRegistration,
          installation: installationDetails,
          circuits: circuitTestResults,
          inspections,
          declarations: {
            ...declarations,
            designerName: declarations.inspectorName,
            designerRegistration: declarations.inspectorRegistration,
            dateDesigned: issueDate,
            installerName: declarations.inspectorName,
            installerRegistration: declarations.inspectorRegistration,
            dateInstalled: issueDate
          },
          observations: test.notes
        };

        pdfBuffer = await generateEICPDF(eicData);

      } else if (input.certificate_type === 'minor_works') {
        // For minor works, typically only one circuit
        const c0 = circuits[0];
        const testResults = c0 ? {
          circuitReference: c0.circuit_reference,
          location: c0.location || '',
          continuityR1R2: c0.continuity_r1_r2 != null ? parseFloat(c0.continuity_r1_r2) : undefined,
          insulationResistance: c0.insulation_resistance != null ? parseFloat(c0.insulation_resistance) : undefined,
          earthLoopImpedance: c0.earth_loop_impedance != null ? parseFloat(c0.earth_loop_impedance) : undefined,
          polarityCorrect: c0.polarity_correct !== false,
          rcdTripTime: undefined
        } : {
          circuitReference: 'Not specified',
          location: 'Not specified',
          polarityCorrect: true
        };

        const minorWorksData: MinorWorksData = {
          certificateNumber,
          issueDate,
          businessName,
          businessAddress,
          businessPhone,
          businessEmail,
          businessRegistration,
          installation: installationDetails,
          workDescription: test.description || 'Minor electrical works',
          testResults,
          inspections,
          declarations
        };

        pdfBuffer = await generateMinorWorksPDF(minorWorksData);

      } else if (input.certificate_type === 'eicr') {
        // Parse observations from notes or dedicated field
        const observations = [];
        if (test.outcome === 'unsatisfactory') {
          observations.push({
            code: 'C2' as const,
            description: 'Installation requires attention',
            recommendation: 'Remedial work required before next use'
          });
        }

        const eicrData: EICRData = {
          certificateNumber,
          issueDate,
          businessName,
          businessAddress,
          businessPhone,
          businessEmail,
          businessRegistration,
          installation: installationDetails,
          extentOfInspection: 'Full visual inspection and testing of accessible circuits and equipment',
          limitations: [],
          overallAssessment: test.outcome === 'satisfactory' ? 'satisfactory' : 'unsatisfactory',
          observations,
          circuits: circuitTestResults,
          inspections,
          declarations,
          summary: test.notes
        };

        pdfBuffer = await generateEICRPDF(eicrData);

      } else {
        throw new Error(`Certificate type ${input.certificate_type} not yet implemented`);
      }

      span.addEvent('pdf_generated', {
        size_bytes: pdfBuffer.length
      });

      // Upload to Supabase Storage
      const storagePath = await uploadCertificatePDF(
        context.tenant_id,
        certificateNumber,
        pdfBuffer
      );

      span.addEvent('pdf_uploaded', {
        storage_path: storagePath
      });

      // Insert certificate record
      const result = await query(
        `INSERT INTO test_certificates (
          tenant_id, test_id, certificate_number, certificate_type,
          issue_date, expiry_date, storage_url, file_size_bytes, generated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          context.tenant_id,
          input.test_id,
          certificateNumber,
          input.certificate_type,
          issueDate,
          input.expiry_date || test.next_inspection_date,
          storagePath,
          pdfBuffer.length,
          context.user_id,
        ]
      );

      const certificate = result.rows[0];

      // Publish event
      await publishEvent({
        id: randomUUID(),
        type: 'tests.certificate_generated',
        tenant_id: context.tenant_id,
        occurred_at: new Date().toISOString(),
        actor: { user_id: context.user_id },
        data: {
          test_id: input.test_id,
          test_number: test.test_number,
          certificate_id: certificate.id,
          certificate_number: certificateNumber,
          certificate_type: input.certificate_type,
          storage_path: storagePath,
          file_size_bytes: pdfBuffer.length
        },
        schema: 'urn:jobbuilda:events:tests.certificate_generated:1',
      });

      return {
        ...certificate,
        pdf_size_kb: Math.round(pdfBuffer.length / 1024)
      };
    } catch (error) {
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}
