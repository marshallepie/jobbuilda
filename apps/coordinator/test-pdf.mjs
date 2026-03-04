/**
 * Quick local test for PDF generation using the compiled coordinator module.
 * Run with: node test-pdf.mjs
 */
import { generatePDFFromHTML } from './dist/lib/pdf.js';
import { writeFileSync } from 'fs';
import { execSync } from 'child_process';

console.log('Testing PDF generation via coordinator module...\n');

const html = `
  <html><body style="font-family:sans-serif;padding:40px">
    <h1 style="color:#dc2626">INVOICE</h1>
    <p>INV-TEST-001 &nbsp;·&nbsp; 4 March 2026</p>
    <table border="1" cellpadding="8" style="width:100%;border-collapse:collapse;margin-top:20px">
      <thead style="background:#dc2626;color:white">
        <tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>
      </thead>
      <tbody>
        <tr><td>Labour</td><td>8 hrs</td><td>£75.00</td><td>£600.00</td></tr>
        <tr><td>Materials</td><td>1</td><td>£120.00</td><td>£120.00</td></tr>
      </tbody>
    </table>
    <p style="text-align:right;margin-top:20px"><strong>Total: £720.00 + VAT</strong></p>
  </body></html>
`;

try {
  const pdf = await generatePDFFromHTML(html, { format: 'A4', printBackground: true });
  const outPath = '/tmp/test-invoice-local.pdf';
  writeFileSync(outPath, pdf);
  console.log(`✓ PDF generated successfully (${pdf.length} bytes)`);
  console.log(`  Saved to: ${outPath}`);
  try { execSync(`open ${outPath}`); } catch {}
  process.exit(0);
} catch (err) {
  console.error('✗ PDF generation failed:', err.message);
  process.exit(1);
}
