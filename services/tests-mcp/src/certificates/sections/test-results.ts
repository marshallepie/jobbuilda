/**
 * Test Results Section for BS 7671 Certificates
 * Displays Schedule of Test Results table with circuit measurements
 */

import PDFDocument from 'pdfkit';
import type PDFKit from 'pdfkit';

export interface CircuitTestResult {
  circuitReference: string;
  location: string;
  deviceType: string;
  deviceRating: string;
  conductorCSA?: string;
  continuityR1R2?: number;
  insulationResistance?: number;
  earthLoopImpedance?: number;
  polarityCorrect?: boolean;
  rcdTripTime?: number;
  result: 'satisfactory' | 'unsatisfactory' | 'not_tested';
}

export function renderTestResultsTable(
  doc: PDFKit.PDFDocument,
  circuits: CircuitTestResult[]
): void {
  doc.fontSize(12).font('Helvetica-Bold');
  doc.text('SCHEDULE OF TEST RESULTS', 50, doc.y);
  doc.moveDown(0.5);

  // Table dimensions
  const tableTop = doc.y;
  const tableLeft = 50;
  const rowHeight = 20;
  const colWidths = [40, 90, 80, 50, 50, 45, 45, 45, 40, 45]; // Adjusted for landscape-like fit

  // Column headers
  const headers = [
    'Cct\nRef',
    'Location',
    'Device\nType',
    'Rating',
    'CSA',
    'R1+R2\n(Ω)',
    'Insul.\n(MΩ)',
    'Zs\n(Ω)',
    'Pol.',
    'Result'
  ];

  // Draw header row
  doc.fontSize(7).font('Helvetica-Bold');
  let x = tableLeft;
  let y = tableTop;

  headers.forEach((header, i) => {
    doc.text(header, x + 2, y + 2, { width: colWidths[i] - 4, align: 'center' });
    x += colWidths[i];
  });

  // Draw header border
  doc.rect(tableLeft, tableTop, colWidths.reduce((a, b) => a + b, 0), rowHeight).stroke();

  // Draw vertical lines for header
  x = tableLeft;
  headers.forEach((_, i) => {
    doc.moveTo(x, tableTop).lineTo(x, tableTop + rowHeight).stroke();
    x += colWidths[i];
  });
  doc.moveTo(x, tableTop).lineTo(x, tableTop + rowHeight).stroke(); // Right edge

  // Draw data rows
  y = tableTop + rowHeight;
  doc.fontSize(7).font('Helvetica');

  circuits.forEach((circuit, rowIndex) => {
    // Check if we need a new page
    if (y > 700) {
      doc.addPage();
      y = 50;
    }

    const rowData = [
      circuit.circuitReference,
      circuit.location,
      circuit.deviceType,
      circuit.deviceRating,
      circuit.conductorCSA || '-',
      circuit.continuityR1R2 !== undefined ? circuit.continuityR1R2.toFixed(3) : '-',
      circuit.insulationResistance !== undefined ? circuit.insulationResistance.toFixed(1) : '-',
      circuit.earthLoopImpedance !== undefined ? circuit.earthLoopImpedance.toFixed(2) : '-',
      circuit.polarityCorrect !== undefined ? (circuit.polarityCorrect ? '✓' : '✗') : '-',
      circuit.result === 'satisfactory' ? 'SAT' : circuit.result === 'unsatisfactory' ? 'UNSAT' : 'N/T'
    ];

    x = tableLeft;
    rowData.forEach((data, i) => {
      const align = i >= 5 && i <= 8 ? 'right' : 'left'; // Numbers right-aligned
      doc.text(data, x + 2, y + 5, { width: colWidths[i] - 4, align });
      x += colWidths[i];
    });

    // Draw row border
    doc.rect(tableLeft, y, colWidths.reduce((a, b) => a + b, 0), rowHeight).stroke();

    // Draw vertical lines
    x = tableLeft;
    colWidths.forEach((width) => {
      doc.moveTo(x, y).lineTo(x, y + rowHeight).stroke();
      x += width;
    });
    doc.moveTo(x, y).lineTo(x, y + rowHeight).stroke(); // Right edge

    y += rowHeight;
  });

  doc.y = y + 10;

  // Notes section
  doc.fontSize(7).font('Helvetica');
  doc.text('Notes:', 50, doc.y);
  doc.text('R1+R2 = Continuity of protective conductors', 60, doc.y + 10);
  doc.text('Insul. = Insulation resistance (Line-Earth)', 60, doc.y + 15);
  doc.text('Zs = Earth fault loop impedance', 60, doc.y + 20);
  doc.text('Pol. = Polarity (✓ = correct, ✗ = incorrect)', 60, doc.y + 25);
  doc.text('SAT = Satisfactory, UNSAT = Unsatisfactory, N/T = Not Tested', 60, doc.y + 30);

  doc.moveDown(4);
}

/**
 * Render Schedule of Inspections (checklist)
 */
export interface InspectionItem {
  category: string;
  item: string;
  result?: 'pass' | 'fail' | 'n/a' | 'limitation';
  notes?: string;
}

export function renderScheduleOfInspections(
  doc: PDFKit.PDFDocument,
  items: InspectionItem[]
): void {
  doc.fontSize(12).font('Helvetica-Bold');
  doc.text('SCHEDULE OF INSPECTIONS', 50, doc.y);
  doc.moveDown(0.5);

  const tableTop = doc.y;
  const tableLeft = 50;
  const rowHeight = 15;
  const colWidths = [250, 60, 230]; // Item, Result, Notes

  // Header
  doc.fontSize(8).font('Helvetica-Bold');
  let x = tableLeft;
  let y = tableTop;

  const headers = ['Inspection Item', 'Result', 'Notes'];
  headers.forEach((header, i) => {
    doc.text(header, x + 2, y + 2, { width: colWidths[i] - 4 });
    x += colWidths[i];
  });

  doc.rect(tableLeft, tableTop, colWidths.reduce((a, b) => a + b, 0), rowHeight).stroke();

  // Draw vertical lines
  x = tableLeft;
  headers.forEach((_, i) => {
    doc.moveTo(x, tableTop).lineTo(x, tableTop + rowHeight).stroke();
    x += colWidths[i];
  });
  doc.moveTo(x, tableTop).lineTo(x, tableTop + rowHeight).stroke();

  // Data rows
  y = tableTop + rowHeight;
  doc.fontSize(7).font('Helvetica');

  let currentCategory = '';

  items.forEach((item) => {
    // Check for new page
    if (y > 720) {
      doc.addPage();
      y = 50;
    }

    // Category header
    if (item.category !== currentCategory) {
      currentCategory = item.category;
      doc.font('Helvetica-Bold');
      doc.text(item.category, tableLeft + 2, y + 3, { width: colWidths[0] - 4 });
      doc.font('Helvetica');

      doc.rect(tableLeft, y, colWidths.reduce((a, b) => a + b, 0), rowHeight).stroke();
      y += rowHeight;
    }

    // Item row
    const resultSymbols: Record<string, string> = {
      pass: '✓',
      fail: '✗',
      'n/a': 'N/A',
      n_a: 'N/A',
      limitation: 'LIM'
    };

    const resultText = item.result ? resultSymbols[item.result] || '-' : '-';

    doc.text(item.item, tableLeft + 5, y + 3, { width: colWidths[0] - 7 });
    doc.text(resultText, tableLeft + colWidths[0] + 2, y + 3, { width: colWidths[1] - 4, align: 'center' });
    doc.text(item.notes || '', tableLeft + colWidths[0] + colWidths[1] + 2, y + 3, { width: colWidths[2] - 4 });

    doc.rect(tableLeft, y, colWidths.reduce((a, b) => a + b, 0), rowHeight).stroke();

    // Draw vertical lines
    x = tableLeft;
    colWidths.forEach((width) => {
      doc.moveTo(x, y).lineTo(x, y + rowHeight).stroke();
      x += width;
    });
    doc.moveTo(x, y).lineTo(x, y + rowHeight).stroke();

    y += rowHeight;
  });

  doc.y = y + 10;
}
