/**
 * Declarations Section for BS 7671 Certificates
 * Includes signatures and required declarations
 */

import PDFDocument from 'pdfkit';
import type PDFKit from 'pdfkit';

export interface DeclarationDetails {
  // Inspector/Tester
  inspectorName: string;
  inspectorRegistration?: string;
  inspectorSignature?: string; // Future: could be base64 image
  dateInspected: string;

  // For EIC - Designer and Installer may be different
  designerName?: string;
  designerRegistration?: string;
  dateDesigned?: string;

  installerName?: string;
  installerRegistration?: string;
  dateInstalled?: string;

  // Next inspection recommendation
  nextInspectionDate?: string;
  nextInspectionMonths?: number;
}

export function renderDeclarations(
  doc: PDFKit.PDFDocument,
  details: DeclarationDetails,
  certificateType: 'eic' | 'minor_works' | 'eicr'
): void {
  doc.fontSize(12).font('Helvetica-Bold');
  doc.text('DECLARATIONS', 50, doc.y);
  doc.moveDown(0.5);

  const leftCol = 50;
  const rightCol = 320;
  const boxWidth = 240;
  const boxHeight = 80;

  doc.fontSize(8).font('Helvetica');

  // For EIC: Designer, Installer, and Inspector
  if (certificateType === 'eic') {
    // Designer Declaration
    doc.font('Helvetica-Bold').text('DESIGNER:', leftCol, doc.y);
    doc.font('Helvetica');
    const designerBoxTop = doc.y + 5;

    doc.text(
      'I certify that the design work for which I am responsible is to the best of my knowledge and belief in accordance with BS 7671:2018+A3:2024, amended to:',
      leftCol,
      designerBoxTop,
      { width: boxWidth - 10 }
    );

    doc.rect(leftCol, designerBoxTop - 5, boxWidth, boxHeight).stroke();

    doc.text('Name:', leftCol + 10, designerBoxTop + 35);
    doc.text(details.designerName || '________________________', leftCol + 45, designerBoxTop + 35);

    doc.text('Registration:', leftCol + 10, designerBoxTop + 50);
    doc.text(details.designerRegistration || '________________________', leftCol + 65, designerBoxTop + 50);

    doc.text('Date:', leftCol + 10, designerBoxTop + 65);
    doc.text(details.dateDesigned || '________________________', leftCol + 35, designerBoxTop + 65);

    // Installer Declaration
    doc.font('Helvetica-Bold').text('INSTALLER:', leftCol, designerBoxTop + boxHeight + 15);
    doc.font('Helvetica');
    const installerBoxTop = doc.y + 5;

    doc.text(
      'I certify that the installation work for which I am responsible is to the best of my knowledge and belief in accordance with BS 7671:2018+A3:2024, amended to:',
      leftCol,
      installerBoxTop,
      { width: boxWidth - 10 }
    );

    doc.rect(leftCol, installerBoxTop - 5, boxWidth, boxHeight).stroke();

    doc.text('Name:', leftCol + 10, installerBoxTop + 35);
    doc.text(details.installerName || '________________________', leftCol + 45, installerBoxTop + 35);

    doc.text('Registration:', leftCol + 10, installerBoxTop + 50);
    doc.text(details.installerRegistration || '________________________', leftCol + 65, installerBoxTop + 50);

    doc.text('Date:', leftCol + 10, installerBoxTop + 65);
    doc.text(details.dateInstalled || '________________________', leftCol + 35, installerBoxTop + 65);

    doc.y = designerBoxTop - 5; // Reset for right column
  }

  // Inspector/Tester Declaration (all certificate types)
  const inspectorLabel = certificateType === 'eicr' ? 'INSPECTOR:' : 'INSPECTOR/TESTER:';
  const inspectorBoxLeft = certificateType === 'eic' ? rightCol : leftCol;
  const inspectorBoxTop = certificateType === 'eic' ? doc.y + 5 : doc.y + 5;

  doc.font('Helvetica-Bold').text(inspectorLabel, inspectorBoxLeft, inspectorBoxTop - 20);
  doc.font('Helvetica');

  const inspectorText = certificateType === 'eicr'
    ? 'I certify that the installation has been inspected and tested and the results are recorded in this report.'
    : 'I certify that the installation has been inspected and tested and the results are recorded on this certificate.';

  doc.text(
    inspectorText,
    inspectorBoxLeft,
    inspectorBoxTop,
    { width: boxWidth - 10 }
  );

  doc.rect(inspectorBoxLeft, inspectorBoxTop - 5, boxWidth, boxHeight).stroke();

  doc.text('Name:', inspectorBoxLeft + 10, inspectorBoxTop + 35);
  doc.text(details.inspectorName || '________________________', inspectorBoxLeft + 45, inspectorBoxTop + 35);

  doc.text('Registration:', inspectorBoxLeft + 10, inspectorBoxTop + 50);
  doc.text(details.inspectorRegistration || '________________________', inspectorBoxLeft + 65, inspectorBoxTop + 50);

  doc.text('Date:', inspectorBoxLeft + 10, inspectorBoxTop + 65);
  doc.text(details.dateInspected || '________________________', inspectorBoxLeft + 35, inspectorBoxTop + 65);

  // Move cursor to below all boxes
  const maxY = certificateType === 'eic' ? inspectorBoxTop + boxHeight + 20 : inspectorBoxTop + boxHeight + 20;
  doc.y = maxY;

  // Next Inspection Recommendation (EICR and EIC)
  if (certificateType === 'eicr' || certificateType === 'eic') {
    doc.moveDown();
    doc.font('Helvetica-Bold').text('NEXT INSPECTION RECOMMENDATION:', leftCol, doc.y);
    doc.moveDown(0.5);
    doc.font('Helvetica');

    const recommendationText = details.nextInspectionDate
      ? `I recommend that this installation is further inspected and tested no later than: ${details.nextInspectionDate}`
      : 'I recommend that this installation is further inspected and tested no later than: _______________';

    doc.text(recommendationText, leftCol, doc.y, { width: 495 });

    if (details.nextInspectionMonths) {
      doc.moveDown(0.5);
      const intervalLabels = {
        12: 'Annual inspection (1 year)',
        60: 'Every 5 years (commercial premises)',
        120: 'Every 10 years (domestic premises)'
      };
      const intervalText = intervalLabels[details.nextInspectionMonths as keyof typeof intervalLabels]
        || `Every ${details.nextInspectionMonths} months`;
      doc.text(`(${intervalText})`, leftCol, doc.y);
    }

    doc.moveDown();
    doc.rect(leftCol, doc.y, 495, 40).stroke();
    doc.fontSize(7).text(
      'Note: The frequency of inspection and testing should be determined by the type of installation, the external influences to which it is exposed, and the nature of use.',
      leftCol + 5,
      doc.y + 5,
      { width: 485 }
    );
  }

  doc.moveDown(2);
}

/**
 * Render signature box
 */
export function renderSignatureBox(
  doc: PDFKit.PDFDocument,
  label: string,
  name: string,
  date: string,
  registration?: string
): void {
  const boxLeft = 50;
  const boxTop = doc.y;
  const boxWidth = 240;
  const boxHeight = 60;

  doc.fontSize(9).font('Helvetica-Bold');
  doc.text(label, boxLeft, boxTop);

  doc.rect(boxLeft, boxTop + 15, boxWidth, boxHeight).stroke();

  doc.fontSize(8).font('Helvetica');
  doc.text('Name:', boxLeft + 10, boxTop + 20);
  doc.text(name, boxLeft + 50, boxTop + 20);

  if (registration) {
    doc.text('Registration:', boxLeft + 10, boxTop + 35);
    doc.text(registration, boxLeft + 70, boxTop + 35);
  }

  doc.text('Date:', boxLeft + 10, boxTop + 50);
  doc.text(date, boxLeft + 50, boxTop + 50);

  doc.text('Signature:', boxLeft + 10, boxTop + 65);
  doc.text('_______________________', boxLeft + 60, boxTop + 65);

  doc.y = boxTop + boxHeight + 25;
}
