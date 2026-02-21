/**
 * PDF Header Section for BS 7671 Certificates
 * Includes branding, logo, and certificate title
 */

import PDFDocument from 'pdfkit';
import type PDFKit from 'pdfkit';

export interface HeaderOptions {
  certificateType: 'eic' | 'minor_works' | 'eicr';
  certificateNumber: string;
  issueDate: string;
  businessName?: string;
  businessAddress?: string;
  businessPhone?: string;
  businessEmail?: string;
  businessRegistration?: string;
}

export function renderHeader(doc: PDFKit.PDFDocument, options: HeaderOptions): void {
  const { certificateType, certificateNumber, issueDate } = options;

  // Title based on certificate type
  const titles = {
    eic: 'ELECTRICAL INSTALLATION CERTIFICATE',
    minor_works: 'MINOR ELECTRICAL INSTALLATION WORKS CERTIFICATE',
    eicr: 'ELECTRICAL INSTALLATION CONDITION REPORT'
  };

  const subtitles = {
    eic: 'BS 7671:2018+A3:2024 Requirements for Electrical Installations',
    minor_works: 'BS 7671:2018+A3:2024',
    eicr: 'BS 7671:2018+A3:2024'
  };

  // Business branding section (top left)
  doc.fontSize(12).font('Helvetica-Bold');
  if (options.businessName) {
    doc.text(options.businessName, 50, 50);
    doc.fontSize(9).font('Helvetica');
    if (options.businessAddress) {
      doc.text(options.businessAddress, 50, 67, { width: 250 });
    }
    if (options.businessPhone) {
      doc.text(`Tel: ${options.businessPhone}`, 50, doc.y + 5);
    }
    if (options.businessEmail) {
      doc.text(`Email: ${options.businessEmail}`, 50, doc.y + 2);
    }
    if (options.businessRegistration) {
      doc.text(`Reg: ${options.businessRegistration}`, 50, doc.y + 2);
    }
  }

  // Certificate number and date (top right)
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text(`Certificate No: ${certificateNumber}`, 400, 50, { align: 'right' });
  doc.fontSize(9).font('Helvetica');
  doc.text(`Issue Date: ${issueDate}`, 400, doc.y + 5, { align: 'right' });

  // Main title (centered)
  doc.moveDown(3);
  doc.fontSize(16).font('Helvetica-Bold');
  doc.text(titles[certificateType], 50, doc.y, { align: 'center', width: 495 });

  doc.moveDown(0.5);
  doc.fontSize(9).font('Helvetica');
  doc.text(subtitles[certificateType], 50, doc.y, { align: 'center', width: 495 });

  // Horizontal line
  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();

  doc.moveDown();
}

/**
 * Add page footer with page numbers
 */
export function renderFooter(doc: PDFKit.PDFDocument, pageNumber: number, totalPages: number): void {
  const bottomY = 750; // Fixed position near bottom

  doc.fontSize(8).font('Helvetica');
  doc.text(
    `Page ${pageNumber} of ${totalPages}`,
    50,
    bottomY,
    { align: 'center', width: 495 }
  );

  doc.text(
    'This certificate is only valid when signed by a competent person',
    50,
    bottomY + 12,
    { align: 'center', width: 495 }
  );
}
