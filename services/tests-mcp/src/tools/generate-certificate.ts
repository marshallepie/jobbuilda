import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';
import { randomUUID } from 'crypto';

const tracer = trace.getTracer('tests-mcp');

interface GenerateCertificateInput {
  test_id: string;
  certificate_type: 'eicr' | 'eic' | 'pat' | 'minor_works';
  issue_date?: string;
  expiry_date?: string;
}

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

      // Get test
      const testResult = await query(
        `SELECT * FROM tests WHERE id = $1 AND tenant_id = $2`,
        [input.test_id, context.tenant_id]
      );

      if (testResult.rows.length === 0) {
        throw new Error('Test not found');
      }

      const test = testResult.rows[0];

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

      // In production, this would trigger PDF generation and S3 upload
      // For now, we'll use a placeholder storage URL
      const storageUrl = `https://storage.jobbuilda.com/certificates/${context.tenant_id}/${certificateNumber}.pdf`;

      // Insert certificate
      const result = await query(
        `INSERT INTO test_certificates (
          tenant_id, test_id, certificate_number, certificate_type,
          issue_date, expiry_date, storage_url, generated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          context.tenant_id,
          input.test_id,
          certificateNumber,
          input.certificate_type,
          issueDate,
          input.expiry_date || null,
          storageUrl,
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
        },
        schema: 'urn:jobbuilda:events:tests.certificate_generated:1',
      });

      return certificate;
    } finally {
      span.end();
    }
  });
}
