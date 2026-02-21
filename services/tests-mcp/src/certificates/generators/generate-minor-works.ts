/**
 * Minor Electrical Installation Works Certificate Generator
 * BS 7671:2018+A3:2024 compliant certificate for minor alterations
 */

import PDFDocument from 'pdfkit';
import type PDFKit from 'pdfkit';
import { renderHeader, renderFooter } from '../sections/header.js';
import { renderInstallationDetails, InstallationDetails } from '../sections/installation-details.js';
import { renderScheduleOfInspections, InspectionItem } from '../sections/test-results.js';
import { renderDeclarations, DeclarationDetails } from '../sections/declarations.js';

export interface MinorWorksData {
  certificateNumber: string;
  issueDate: string;

  // Business details
  businessName: string;
  businessAddress: string;
  businessPhone?: string;
  businessEmail?: string;
  businessRegistration?: string;

  // Installation details
  installation: InstallationDetails;

  // Work description
  workDescription: string;
  departures?: string; // Departures from BS 7671 (if any)

  // Test results (simplified for minor works)
  testResults: {
    circuitReference: string;
    location: string;
    continuityR1R2?: number;
    insulationResistance?: number;
    earthLoopImpedance?: number;
    polarityCorrect: boolean;
    rcdTripTime?: number;
  };

  // Schedule of inspections (simplified)
  inspections: InspectionItem[];

  // Declarations
  declarations: Omit<DeclarationDetails, 'designerName' | 'installerName'>; // No designer/installer for minor works
}

/**
 * Generate Minor Works Certificate PDF and return as Buffer
 */
export async function generateMinorWorksPDF(data: MinorWorksData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Minor Works Certificate - ${data.certificateNumber}`,
          Author: data.businessName,
          Subject: 'BS 7671:2018+A3:2024 Minor Works',
          Keywords: 'electrical, certificate, minor works, BS7671'
        }
      });

      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Page 1: Header and Details
      renderHeader(doc, {
        certificateType: 'minor_works',
        certificateNumber: data.certificateNumber,
        issueDate: data.issueDate,
        businessName: data.businessName,
        businessAddress: data.businessAddress,
        businessPhone: data.businessPhone,
        businessEmail: data.businessEmail,
        businessRegistration: data.businessRegistration
      });

      renderInstallationDetails(doc, data.installation);

      // Description of Minor Works
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('DESCRIPTION OF MINOR WORKS', 50, doc.y);
      doc.moveDown(0.5);
      doc.fontSize(9).font('Helvetica');
      doc.text(data.workDescription, 50, doc.y, { width: 495 });
      doc.moveDown();

      // Departures from BS 7671 (if any)
      if (data.departures) {
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('DEPARTURES FROM BS 7671', 50, doc.y);
        doc.moveDown(0.3);
        doc.fontSize(8).font('Helvetica');
        doc.text(data.departures, 50, doc.y, { width: 495 });
        doc.moveDown();
      } else {
        doc.fontSize(9).font('Helvetica');
        doc.text('No departures from BS 7671:2018+A3:2024', 50, doc.y);
        doc.moveDown();
      }

      // Circuit Details
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('CIRCUIT DETAILS', 50, doc.y);
      doc.moveDown(0.5);

      const leftCol = 50;
      const rightCol = 320;
      let y = doc.y;

      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Circuit Reference:', leftCol, y);
      doc.font('Helvetica').text(data.testResults.circuitReference, leftCol + 120, y);
      y += 18;

      doc.font('Helvetica-Bold').text('Location:', leftCol, y);
      doc.font('Helvetica').text(data.testResults.location, leftCol + 120, y);
      y += 18;

      doc.moveDown(2);

      // Test Results Table
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('TEST RESULTS', 50, doc.y);
      doc.moveDown(0.5);

      const tableTop = doc.y;
      const tableLeft = 50;
      const rowHeight = 25;

      doc.fontSize(9).font('Helvetica');

      // Test measurements
      const tests = [
        {
          label: 'Continuity of Protective Conductors (R1+R2)',
          value: data.testResults.continuityR1R2 !== undefined ? `${data.testResults.continuityR1R2.toFixed(3)} Ω` : 'N/A',
          result: data.testResults.continuityR1R2 !== undefined && data.testResults.continuityR1R2 < 0.5 ? 'PASS' : 'N/A'
        },
        {
          label: 'Insulation Resistance',
          value: data.testResults.insulationResistance !== undefined ? `${data.testResults.insulationResistance.toFixed(1)} MΩ` : 'N/A',
          result: data.testResults.insulationResistance !== undefined && data.testResults.insulationResistance >= 1.0 ? 'PASS' : 'FAIL'
        },
        {
          label: 'Earth Fault Loop Impedance (Zs)',
          value: data.testResults.earthLoopImpedance !== undefined ? `${data.testResults.earthLoopImpedance.toFixed(2)} Ω` : 'N/A',
          result: data.testResults.earthLoopImpedance !== undefined && data.testResults.earthLoopImpedance < 2.0 ? 'PASS' : 'CHECK'
        },
        {
          label: 'Polarity',
          value: data.testResults.polarityCorrect ? 'Correct' : 'Incorrect',
          result: data.testResults.polarityCorrect ? 'PASS' : 'FAIL'
        }
      ];

      if (data.testResults.rcdTripTime !== undefined) {
        tests.push({
          label: 'RCD Trip Time (30mA)',
          value: `${data.testResults.rcdTripTime} ms`,
          result: data.testResults.rcdTripTime <= 300 ? 'PASS' : 'FAIL'
        });
      }

      y = tableTop;
      tests.forEach((test, i) => {
        // Test label
        doc.font('Helvetica-Bold').text(test.label, tableLeft, y);

        // Value
        doc.font('Helvetica').text(test.value, rightCol, y);

        // Result
        const resultColor = test.result === 'PASS' ? '#008000' : test.result === 'FAIL' ? '#FF0000' : '#000000';
        doc.fillColor(resultColor).text(test.result, rightCol + 120, y).fillColor('#000000');

        y += rowHeight;
      });

      doc.moveDown(3);

      // Schedule of Inspections
      if (data.inspections && data.inspections.length > 0) {
        renderScheduleOfInspections(doc, data.inspections);
      }

      // Comments on Existing Installation
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('COMMENTS ON EXISTING INSTALLATION', 50, doc.y);
      doc.moveDown(0.3);
      doc.fontSize(8).font('Helvetica');
      doc.text(
        'The existing installation is in a satisfactory condition for the minor works undertaken. Any observations are noted in the Schedule of Inspections above.',
        50,
        doc.y,
        { width: 495 }
      );
      doc.moveDown(2);

      // Declarations
      doc.addPage();
      renderDeclarations(doc, data.declarations as DeclarationDetails, 'minor_works');

      // Important Notes
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('IMPORTANT INFORMATION', 50, doc.y);
      doc.moveDown(0.5);
      doc.fontSize(7).font('Helvetica');
      doc.text(
        'This certificate covers only the minor electrical works detailed above. It does not cover the rest of the existing installation. A full Electrical Installation Certificate or Periodic Inspection Report may be required for the complete installation.',
        50,
        doc.y,
        { width: 495 }
      );
      doc.moveDown();
      doc.text(
        'This certificate is only valid when signed by a competent person. The work covered by this certificate complied with BS 7671 at the time of completion.',
        50,
        doc.y,
        { width: 495 }
      );
      doc.moveDown();
      doc.text(
        'The overall electrical installation should still be periodically inspected and tested. Consult a qualified electrician for advice on inspection intervals.',
        50,
        doc.y,
        { width: 495 }
      );

      // Footer on all pages
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        renderFooter(doc, i + 1, pageCount);
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
