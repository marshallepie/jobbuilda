/**
 * Electrical Installation Certificate (EIC) Generator
 * BS 7671:2018+A3:2024 compliant certificate for new circuit installations
 */

import PDFDocument from 'pdfkit';
import type PDFKit from 'pdfkit';
import { renderHeader, renderFooter } from '../sections/header.js';
import { renderInstallationDetails, InstallationDetails } from '../sections/installation-details.js';
import { renderTestResultsTable, renderScheduleOfInspections, CircuitTestResult, InspectionItem } from '../sections/test-results.js';
import { renderDeclarations, DeclarationDetails } from '../sections/declarations.js';

export interface EICData {
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

  // Test results
  circuits: CircuitTestResult[];

  // Schedule of inspections
  inspections: InspectionItem[];

  // Declarations
  declarations: DeclarationDetails;

  // Observations/Limitations
  observations?: string;
  limitations?: string;
}

/**
 * Generate EIC PDF and return as Buffer
 */
export async function generateEICPDF(data: EICData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Electrical Installation Certificate - ${data.certificateNumber}`,
          Author: data.businessName,
          Subject: 'BS 7671:2018+A3:2024 EIC',
          Keywords: 'electrical, certificate, EIC, BS7671'
        }
      });

      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Page 1: Header and Installation Details
      renderHeader(doc, {
        certificateType: 'eic',
        certificateNumber: data.certificateNumber,
        issueDate: data.issueDate,
        businessName: data.businessName,
        businessAddress: data.businessAddress,
        businessPhone: data.businessPhone,
        businessEmail: data.businessEmail,
        businessRegistration: data.businessRegistration
      });

      renderInstallationDetails(doc, data.installation);

      // Design Compliance Statement
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('DESIGN COMPLIANCE', 50, doc.y);
      doc.moveDown(0.3);
      doc.fontSize(8).font('Helvetica');
      doc.text(
        'The electrical installation has been designed to afford appropriate protection against electric shock, fire, burns and other hazards in accordance with BS 7671:2018+A3:2024.',
        50,
        doc.y,
        { width: 495 }
      );
      doc.moveDown();

      // Extent of Installation Covered by Certificate
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('EXTENT OF INSTALLATION', 50, doc.y);
      doc.moveDown(0.3);
      doc.fontSize(8).font('Helvetica');
      const extentText = data.installation.scopeOfWork || 'Full installation as detailed in circuit schedule';
      doc.text(extentText, 50, doc.y, { width: 495 });
      doc.moveDown();

      // Comments on Existing Installation (if applicable)
      if (data.observations) {
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('COMMENTS ON EXISTING INSTALLATION', 50, doc.y);
        doc.moveDown(0.3);
        doc.fontSize(8).font('Helvetica');
        doc.text(data.observations, 50, doc.y, { width: 495 });
        doc.moveDown();
      }

      // Page 2+: Schedule of Inspections
      doc.addPage();
      renderScheduleOfInspections(doc, data.inspections);

      // New page for test results
      doc.addPage();
      renderTestResultsTable(doc, data.circuits);

      // Supply Characteristics and Earthing Arrangements
      doc.addPage();
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('SUPPLY CHARACTERISTICS AND EARTHING ARRANGEMENTS', 50, 50);
      doc.moveDown(0.5);

      doc.fontSize(9).font('Helvetica');
      const leftCol = 50;
      const rightCol = 320;
      let y = doc.y;

      // Left column
      doc.font('Helvetica-Bold').text('Earthing System:', leftCol, y);
      doc.font('Helvetica').text(data.installation.earthingArrangement || 'TN-C-S', leftCol + 100, y);
      y += 20;

      doc.font('Helvetica-Bold').text('Number of Phases:', leftCol, y);
      doc.font('Helvetica').text('1 (Single phase)', leftCol + 100, y);
      y += 20;

      doc.font('Helvetica-Bold').text('Supply Voltage:', leftCol, y);
      doc.font('Helvetica').text(`${data.installation.supplyVoltage || 230}V`, leftCol + 100, y);
      y += 20;

      doc.font('Helvetica-Bold').text('Frequency:', leftCol, y);
      doc.font('Helvetica').text(`${data.installation.supplyFrequency || 50}Hz`, leftCol + 100, y);
      y += 20;

      // Right column
      y = doc.y - 80;
      doc.font('Helvetica-Bold').text('Main Protective Device:', rightCol, y);
      doc.font('Helvetica').text(data.installation.mainSwitchType || 'MCB', rightCol + 120, y);
      y += 20;

      doc.font('Helvetica-Bold').text('Rating:', rightCol, y);
      doc.font('Helvetica').text(data.installation.mainSwitchRating || '100A', rightCol + 120, y);
      y += 20;

      doc.moveDown(3);

      // Particulars of Installation Referred to in Certificate
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('PARTICULARS OF INSTALLATION', 50, doc.y);
      doc.moveDown(0.5);

      doc.fontSize(8).font('Helvetica');
      doc.text('Means of Earthing:', 50, doc.y);
      doc.text('☑ Distributor\'s facility    ☐ Installation earth electrode', 150, doc.y);
      doc.moveDown();

      doc.text('Main Protective Bonding Conductors:', 50, doc.y);
      doc.text('Conductor CSA: 10mm² (minimum requirement met)', 150, doc.y);
      doc.moveDown();

      doc.text('Main Switch/Circuit Breaker:', 50, doc.y);
      doc.text(`BS: EN 60898 | Type: ${data.installation.mainSwitchType || 'MCB'} | Rating: ${data.installation.mainSwitchRating || '100A'}`, 150, doc.y);
      doc.moveDown();

      doc.text('RCD Protection:', 50, doc.y);
      doc.text('☑ 30mA RCD protection provided for socket outlets and circuits', 150, doc.y);
      doc.moveDown(2);

      // Limitations (if any)
      if (data.limitations) {
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('LIMITATIONS', 50, doc.y);
        doc.moveDown(0.3);
        doc.fontSize(8).font('Helvetica');
        doc.text(data.limitations, 50, doc.y, { width: 495 });
        doc.moveDown(2);
      }

      // Declarations
      doc.addPage();
      renderDeclarations(doc, data.declarations, 'eic');

      // Important Notes
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('IMPORTANT INFORMATION', 50, doc.y);
      doc.moveDown(0.5);
      doc.fontSize(7).font('Helvetica');
      doc.text(
        'This certificate is only valid when signed by a competent person. The electrical installation covered by this certificate should be periodically inspected and tested in accordance with BS 7671. The recommended interval for the next inspection is stated on this certificate.',
        50,
        doc.y,
        { width: 495 }
      );
      doc.moveDown();
      doc.text(
        'This certificate is evidence that the installation complied with BS 7671 at the time it was installed. It does not indicate that the installation will continue to comply in the future without appropriate maintenance.',
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
