/**
 * Electrical Installation Condition Report (EICR) Generator
 * BS 7671:2018+A3:2024 compliant report for periodic inspections
 */

import PDFDocument from 'pdfkit';
import type PDFKit from 'pdfkit';
import { renderHeader, renderFooter } from '../sections/header.js';
import { renderInstallationDetails, InstallationDetails } from '../sections/installation-details.js';
import { renderTestResultsTable, renderScheduleOfInspections, CircuitTestResult, InspectionItem } from '../sections/test-results.js';
import { renderDeclarations, DeclarationDetails } from '../sections/declarations.js';

export interface Observation {
  code: 'C1' | 'C2' | 'C3' | 'FI'; // Danger, Potentially dangerous, Improvement recommended, Further investigation
  description: string;
  location?: string;
  recommendation: string;
}

export interface EICRData {
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

  // Extent and limitations
  extentOfInspection: string;
  limitations: string[];

  // Overall assessment
  overallAssessment: 'satisfactory' | 'unsatisfactory';

  // Observations
  observations: Observation[];

  // Test results
  circuits: CircuitTestResult[];

  // Schedule of inspections
  inspections: InspectionItem[];

  // Declarations
  declarations: DeclarationDetails;

  // Summary
  summary?: string;
}

/**
 * Generate EICR PDF and return as Buffer
 */
export async function generateEICRPDF(data: EICRData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true,
        info: {
          Title: `EICR - ${data.certificateNumber}`,
          Author: data.businessName,
          Subject: 'BS 7671:2018+A3:2024 EICR',
          Keywords: 'electrical, condition report, EICR, BS7671, inspection'
        }
      });

      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Page 1: Header and Installation Details
      renderHeader(doc, {
        certificateType: 'eicr',
        certificateNumber: data.certificateNumber,
        issueDate: data.issueDate,
        businessName: data.businessName,
        businessAddress: data.businessAddress,
        businessPhone: data.businessPhone,
        businessEmail: data.businessEmail,
        businessRegistration: data.businessRegistration
      });

      renderInstallationDetails(doc, data.installation);

      // Purpose of Report
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('PURPOSE OF REPORT', 50, doc.y);
      doc.moveDown(0.5);
      doc.fontSize(9).font('Helvetica');
      doc.text(
        'This report provides an assessment of the condition of the electrical installation at the time of inspection, with recommendations for any necessary remedial action.',
        50,
        doc.y,
        { width: 495 }
      );
      doc.moveDown();

      // Extent of Inspection
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('EXTENT AND LIMITATIONS OF INSPECTION', 50, doc.y);
      doc.moveDown(0.5);
      doc.fontSize(9).font('Helvetica');
      doc.text(data.extentOfInspection, 50, doc.y, { width: 495 });
      doc.moveDown();

      // Limitations
      if (data.limitations && data.limitations.length > 0) {
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('LIMITATIONS:', 50, doc.y);
        doc.moveDown(0.3);
        doc.fontSize(9).font('Helvetica');
        data.limitations.forEach(limitation => {
          doc.text(`• ${limitation}`, 60, doc.y);
          doc.moveDown(0.3);
        });
        doc.moveDown();
      }

      // Overall Assessment (highlighted)
      const assessmentColor = data.overallAssessment === 'satisfactory' ? '#00AA00' : '#FF0000';
      const assessmentText = data.overallAssessment === 'satisfactory' ? 'SATISFACTORY' : 'UNSATISFACTORY';

      doc.fontSize(14).font('Helvetica-Bold');
      doc.fillColor(assessmentColor);
      doc.text(`OVERALL ASSESSMENT: ${assessmentText}`, 50, doc.y, { align: 'center', width: 495 });
      doc.fillColor('#000000');
      doc.moveDown();

      doc.fontSize(8).font('Helvetica');
      const assessmentNote = data.overallAssessment === 'satisfactory'
        ? 'The installation is in a satisfactory condition and no remedial work is required.'
        : 'The installation has deficiencies which require attention. See observations below.';
      doc.text(assessmentNote, 50, doc.y, { align: 'center', width: 495 });
      doc.moveDown(2);

      // Summary (if provided)
      if (data.summary) {
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('SUMMARY', 50, doc.y);
        doc.moveDown(0.3);
        doc.fontSize(9).font('Helvetica');
        doc.text(data.summary, 50, doc.y, { width: 495 });
        doc.moveDown(2);
      }

      // Observations Section
      doc.addPage();
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('OBSERVATIONS AND RECOMMENDATIONS', 50, 50);
      doc.moveDown(0.5);

      // Observation codes legend
      doc.fontSize(8).font('Helvetica');
      doc.fillColor('#FF0000').text('C1 - Danger present - Immediate remedial action required', 50, doc.y);
      doc.fillColor('#FF6600').text('C2 - Potentially dangerous - Urgent remedial action required', 50, doc.y + 12);
      doc.fillColor('#FFA500').text('C3 - Improvement recommended', 50, doc.y + 24);
      doc.fillColor('#0066CC').text('FI - Further investigation required', 50, doc.y + 36);
      doc.fillColor('#000000');
      doc.moveDown(4);

      if (data.observations.length === 0) {
        doc.fontSize(9).font('Helvetica');
        doc.text('No observations recorded. Installation found to be in satisfactory condition.', 50, doc.y);
        doc.moveDown();
      } else {
        // Group observations by code
        const groupedObs = {
          C1: data.observations.filter(o => o.code === 'C1'),
          C2: data.observations.filter(o => o.code === 'C2'),
          C3: data.observations.filter(o => o.code === 'C3'),
          FI: data.observations.filter(o => o.code === 'FI')
        };

        const codeColors = {
          C1: '#FF0000',
          C2: '#FF6600',
          C3: '#FFA500',
          FI: '#0066CC'
        };

        const codeLabels = {
          C1: 'DANGER PRESENT (C1)',
          C2: 'POTENTIALLY DANGEROUS (C2)',
          C3: 'IMPROVEMENT RECOMMENDED (C3)',
          FI: 'FURTHER INVESTIGATION (FI)'
        };

        Object.entries(groupedObs).forEach(([code, observations]) => {
          if (observations.length > 0) {
            doc.fontSize(11).font('Helvetica-Bold');
            doc.fillColor(codeColors[code as keyof typeof codeColors]);
            doc.text(codeLabels[code as keyof typeof codeLabels], 50, doc.y);
            doc.fillColor('#000000');
            doc.moveDown(0.5);

            observations.forEach((obs, index) => {
              doc.fontSize(9).font('Helvetica-Bold');
              doc.text(`${code}-${index + 1}:`, 50, doc.y);
              doc.font('Helvetica');
              doc.text(obs.description, 80, doc.y - 12, { width: 460 });

              if (obs.location) {
                doc.text(`Location: ${obs.location}`, 80, doc.y);
              }

              doc.text(`Recommendation: ${obs.recommendation}`, 80, doc.y, { width: 460 });
              doc.moveDown();

              // Check for new page
              if (doc.y > 700) {
                doc.addPage();
              }
            });

            doc.moveDown();
          }
        });
      }

      // Schedule of Inspections
      doc.addPage();
      renderScheduleOfInspections(doc, data.inspections);

      // Test Results
      doc.addPage();
      renderTestResultsTable(doc, data.circuits);

      // Recommendations for Next Inspection
      doc.addPage();
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('RECOMMENDATIONS', 50, 50);
      doc.moveDown(0.5);

      doc.fontSize(9).font('Helvetica');

      if (data.overallAssessment === 'unsatisfactory') {
        doc.text(
          'The installation is UNSATISFACTORY and requires remedial work before it can be considered safe. Priority should be given to addressing C1 and C2 observations.',
          50,
          doc.y,
          { width: 495 }
        );
        doc.moveDown();
        doc.text(
          'A further inspection should be carried out after remedial work has been completed to verify that the installation is safe.',
          50,
          doc.y,
          { width: 495 }
        );
      } else {
        doc.text(
          'The installation is in a satisfactory condition. However, the following recommendations are made:',
          50,
          doc.y,
          { width: 495 }
        );
        doc.moveDown();

        if (data.observations.filter(o => o.code === 'C3').length > 0) {
          doc.text(
            '• Consider addressing C3 observations to improve the installation to current standards.',
            60,
            doc.y
          );
          doc.moveDown(0.5);
        }

        doc.text(
          '• The installation should continue to be maintained in good condition.',
          60,
          doc.y
        );
        doc.moveDown(0.5);

        doc.text(
          `• A further periodic inspection is recommended within ${data.declarations.nextInspectionMonths || 60} months.`,
          60,
          doc.y
        );
      }

      doc.moveDown(2);

      // Declarations
      renderDeclarations(doc, data.declarations, 'eicr');

      // Important Notes
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('IMPORTANT INFORMATION', 50, doc.y);
      doc.moveDown(0.5);
      doc.fontSize(7).font('Helvetica');
      doc.text(
        'This report is only valid when signed by a competent person. This report relates only to the condition of the electrical installation at the time of inspection.',
        50,
        doc.y,
        { width: 495 }
      );
      doc.moveDown();
      doc.text(
        'Observations coded C1 or C2 indicate that the installation is potentially dangerous and immediate or urgent action is required. The installation should not be used until remedial work has been carried out.',
        50,
        doc.y,
        { width: 495 }
      );
      doc.moveDown();
      doc.text(
        'This report does not provide a record of routine maintenance or portable appliance testing (PAT). Separate records should be maintained for these activities.',
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
