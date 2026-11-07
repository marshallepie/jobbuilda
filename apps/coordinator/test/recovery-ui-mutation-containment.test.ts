import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const adminPagesDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../admin/src/app',
);

function pageSource(resource: 'quotes' | 'invoices'): string {
  return readFileSync(path.join(adminPagesDirectory, resource, 'page.tsx'), 'utf8');
}

test('recovery quotes screen keeps list and direct-read controls but has no deletion control or request', () => {
  const source = pageSource('quotes');

  assert.match(source, /api\.getQuotes\(\)/);
  assert.match(source, /href=\{`\/quotes\/\$\{quote\.id\}`\}/);
  assert.doesNotMatch(source, /deleteQuote|>\s*Delete\s*</);
  assert.doesNotMatch(source, /api\.request\(/);
  assert.doesNotMatch(source, /\/api\/quotes\/\$\{[^}]+\}/);
  assert.doesNotMatch(source, /method:\s*['"]DELETE['"]/);
});

test('recovery invoices screen keeps list and direct-read controls but has no payment control or request', () => {
  const source = pageSource('invoices');

  assert.match(source, /api\.getInvoices\(\)/);
  assert.match(source, /router\.push\(`\/invoices\/\$\{invoice\.id\}`\)/);
  assert.doesNotMatch(source, /markAsPaid|markingPaidId|Mark paid|Mark as paid|Saving\.\.\./);
  assert.doesNotMatch(source, /api\.request\(/);
  assert.doesNotMatch(source, /\/api\/invoices\/\$\{[^}]+\}\/payment/);
  assert.doesNotMatch(source, /method:\s*['"]POST['"]/);
});