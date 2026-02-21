/**
 * Installation Details Section for BS 7671 Certificates
 * Shows client, site, and installation information
 */

import PDFDocument from 'pdfkit';
import type PDFKit from 'pdfkit';

export interface InstallationDetails {
  // Client information
  clientName: string;
  clientAddress?: string;
  clientPhone?: string;
  clientEmail?: string;

  // Site/installation information
  siteAddress: string;
  sitePostcode: string;
  premisesType: 'domestic' | 'commercial' | 'industrial';

  // Installation details
  installationDescription?: string;
  scopeOfWork?: string;
  earthingArrangement?: 'TN-S' | 'TN-C-S' | 'TT' | 'IT';
  mainSwitchRating?: string;
  mainSwitchType?: string;
  supplyVoltage?: number;
  supplyFrequency?: number;

  // Dates
  dateOfInstallation?: string;
  dateOfInspection: string;
}

export function renderInstallationDetails(doc: PDFKit.PDFDocument, details: InstallationDetails): void {
  const startY = doc.y;
  const leftCol = 50;
  const rightCol = 320;
  const lineHeight = 15;

  // Section title
  doc.fontSize(12).font('Helvetica-Bold');
  doc.text('INSTALLATION DETAILS', leftCol, startY);
  doc.moveDown(0.5);

  const sectionStartY = doc.y;
  doc.fontSize(9).font('Helvetica');

  // Left column
  let y = sectionStartY;

  // Client Information
  doc.font('Helvetica-Bold').text('Client:', leftCol, y);
  doc.font('Helvetica').text(details.clientName, leftCol + 60, y);
  y += lineHeight;

  if (details.clientAddress) {
    doc.text(details.clientAddress, leftCol + 60, y, { width: 200 });
    y = doc.y + 5;
  }

  if (details.clientPhone) {
    doc.text(`Tel: ${details.clientPhone}`, leftCol + 60, y);
    y += lineHeight;
  }

  // Site Address
  y += 5;
  doc.font('Helvetica-Bold').text('Installation Address:', leftCol, y);
  y += lineHeight;
  doc.font('Helvetica').text(details.siteAddress, leftCol + 60, y, { width: 200 });
  y = doc.y + 5;
  doc.text(details.sitePostcode, leftCol + 60, y);
  y += lineHeight;

  // Premises Type
  y += 5;
  const premisesTypeLabels = {
    domestic: 'Domestic',
    commercial: 'Commercial',
    industrial: 'Industrial'
  };
  doc.font('Helvetica-Bold').text('Premises Type:', leftCol, y);
  doc.font('Helvetica').text(premisesTypeLabels[details.premisesType], leftCol + 60, y);
  y += lineHeight;

  // Right column
  y = sectionStartY;

  // Earthing Arrangement
  if (details.earthingArrangement) {
    doc.font('Helvetica-Bold').text('Earthing System:', rightCol, y);
    doc.font('Helvetica').text(details.earthingArrangement, rightCol + 90, y);
    y += lineHeight;
  }

  // Supply Details
  if (details.supplyVoltage) {
    doc.font('Helvetica-Bold').text('Supply Voltage:', rightCol, y);
    doc.font('Helvetica').text(`${details.supplyVoltage}V`, rightCol + 90, y);
    y += lineHeight;
  }

  if (details.supplyFrequency) {
    doc.font('Helvetica-Bold').text('Frequency:', rightCol, y);
    doc.font('Helvetica').text(`${details.supplyFrequency}Hz`, rightCol + 90, y);
    y += lineHeight;
  }

  // Main Switch
  if (details.mainSwitchType) {
    y += 5;
    doc.font('Helvetica-Bold').text('Main Switch:', rightCol, y);
    doc.font('Helvetica').text(details.mainSwitchType, rightCol + 90, y);
    y += lineHeight;
  }

  if (details.mainSwitchRating) {
    doc.font('Helvetica-Bold').text('Rating:', rightCol, y);
    doc.font('Helvetica').text(details.mainSwitchRating, rightCol + 90, y);
    y += lineHeight;
  }

  // Dates
  y += 5;
  if (details.dateOfInstallation) {
    doc.font('Helvetica-Bold').text('Installation Date:', rightCol, y);
    doc.font('Helvetica').text(details.dateOfInstallation, rightCol + 90, y);
    y += lineHeight;
  }

  doc.font('Helvetica-Bold').text('Inspection Date:', rightCol, y);
  doc.font('Helvetica').text(details.dateOfInspection, rightCol + 90, y);
  y += lineHeight;

  // Move document cursor to the furthest point
  const maxY = Math.max(doc.y, y);
  doc.y = maxY + 10;

  // Scope of Work (full width)
  if (details.scopeOfWork) {
    doc.font('Helvetica-Bold').text('Scope of Work:', leftCol, doc.y);
    doc.moveDown(0.3);
    doc.font('Helvetica').text(details.scopeOfWork, leftCol, doc.y, { width: 495 });
    doc.moveDown();
  }

  // Horizontal line
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown();
}
