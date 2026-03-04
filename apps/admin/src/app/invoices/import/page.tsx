'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Client {
  id: string;
  name: string;
  email?: string;
  company?: string;
}

interface ColMap {
  date: number;
  description: number;
  amount: number;
  clientName: number;
  vatRate: number;
  notes: number;
  invoiceType: number;
}

interface ParsedRow {
  rowNum: number;
  raw: string[];
  date: string;
  description: string;
  amount: string;
  clientName: string;
  vatRate: string;
  notes: string;
  invoiceType: string;
  errors: string[];
}

interface ImportRowResult {
  row: number;
  success: boolean;
  invoice_number?: string;
  id?: string;
  error?: string;
}

interface ImportResult {
  total: number;
  succeeded: number;
  failed: number;
  results: ImportRowResult[];
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field.trim());
        field = '';
      } else if (ch === '\t') {
        row.push(field.trim());
        field = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        if (ch === '\r') i++;
        row.push(field.trim());
        if (row.some(f => f !== '')) rows.push(row);
        row = [];
        field = '';
      } else if (ch === '\r') {
        row.push(field.trim());
        if (row.some(f => f !== '')) rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }
  }

  if (field || row.length > 0) {
    row.push(field.trim());
    if (row.some(f => f !== '')) rows.push(row);
  }

  return rows;
}

function detectCol(headers: string[], candidates: string[]): number {
  const lower = headers.map(h => h.toLowerCase().trim().replace(/[^a-z0-9]/g, '_'));
  for (const c of candidates) {
    const idx = lower.indexOf(c.toLowerCase().replace(/[^a-z0-9]/g, '_'));
    if (idx !== -1) return idx;
  }
  return -1;
}

function buildColMap(headers: string[]): ColMap {
  return {
    date: detectCol(headers, ['date', 'invoice_date', 'invoice date', 'Date', 'Invoice Date']),
    description: detectCol(headers, ['description', 'desc', 'item', 'details', 'service', 'work', 'memo']),
    amount: detectCol(headers, ['amount', 'total', 'price', 'value', 'net', 'subtotal', 'sub_total', 'line_total']),
    clientName: detectCol(headers, ['client', 'client_name', 'customer', 'customer_name', 'name']),
    vatRate: detectCol(headers, ['vat', 'vat_rate', 'tax', 'tax_rate', 'vat_percent', 'tax_percent']),
    notes: detectCol(headers, ['notes', 'note', 'memo', 'comments', 'comment', 'remarks']),
    invoiceType: detectCol(headers, ['type', 'invoice_type', 'kind']),
  };
}

function parseDate(raw: string): string {
  if (!raw) return '';
  // Try ISO: 2026-01-15
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmy = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  // Try MM/DD/YYYY
  const mdy = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (mdy) {
    const yr = mdy[3].length === 2 ? `20${mdy[3]}` : mdy[3];
    return `${yr}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  }
  // Try Date.parse as fallback
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return '';
}

function validateRows(rows: ParsedRow[]): ParsedRow[] {
  return rows.map(r => {
    const errors: string[] = [];
    if (!r.date) errors.push('Missing date');
    else if (!parseDate(r.date)) errors.push('Invalid date format');
    if (!r.description) errors.push('Missing description');
    const amt = parseFloat(r.amount.replace(/[£$€,\s]/g, ''));
    if (isNaN(amt)) errors.push('Amount is not a number');
    else if (amt <= 0) errors.push('Amount must be > 0');
    return { ...r, errors };
  });
}

const SAMPLE_CSV = `date,description,amount,client_name,vat_rate,notes
2026-01-15,Electrical installation - kitchen rewire,500.00,Acme Corp,20,Completed on schedule
2026-01-20,Emergency call-out - fuse board,150.00,Smith Residence,20,Weekend emergency
2026-02-01,Consumer unit replacement,850.00,Jones Building Ltd,20,With 12-month warranty
2026-02-10,EV charger installation,400.00,,20,
`;

const TYPE_OPTIONS = ['final', 'deposit', 'progress', 'credit_note'];
const COL_LABELS: Record<keyof ColMap, string> = {
  date: 'Date',
  description: 'Description',
  amount: 'Amount',
  clientName: 'Client Name',
  vatRate: 'VAT Rate',
  notes: 'Notes',
  invoiceType: 'Invoice Type',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImportInvoicesPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [dragOver, setDragOver] = useState(false);

  // Parsed data
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [colMap, setColMap] = useState<ColMap>({
    date: -1, description: -1, amount: -1, clientName: -1,
    vatRate: -1, notes: -1, invoiceType: -1,
  });
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);

  // Options
  const [vatInclusive, setVatInclusive] = useState(false);
  const [defaultVatRate, setDefaultVatRate] = useState(20);
  const [defaultClientId, setDefaultClientId] = useState('');
  const [defaultInvoiceType, setDefaultInvoiceType] = useState<string>('final');
  const [clients, setClients] = useState<Client[]>([]);

  // Import results
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState('');

  useEffect(() => {
    const mockAuth = {
      token: 'mock-jwt-token',
      tenant_id: '550e8400-e29b-41d4-a716-446655440000',
      user_id: '550e8400-e29b-41d4-a716-446655440001',
    };
    api.setAuth(mockAuth);
    api.getClients().then((data: any) => {
      setClients(Array.isArray(data) ? data : (data?.data || []));
    }).catch(() => {});
  }, []);

  // Re-parse rows whenever column mapping or options change
  useEffect(() => {
    if (rawRows.length === 0) return;
    const rows = rawRows.map((raw, idx): ParsedRow => ({
      rowNum: idx + 2, // +2: 1-indexed + skip header
      raw,
      date: colMap.date >= 0 ? raw[colMap.date] || '' : '',
      description: colMap.description >= 0 ? raw[colMap.description] || '' : '',
      amount: colMap.amount >= 0 ? raw[colMap.amount] || '' : '',
      clientName: colMap.clientName >= 0 ? raw[colMap.clientName] || '' : '',
      vatRate: colMap.vatRate >= 0 ? raw[colMap.vatRate] || '' : '',
      notes: colMap.notes >= 0 ? raw[colMap.notes] || '' : '',
      invoiceType: colMap.invoiceType >= 0 ? raw[colMap.invoiceType] || '' : '',
      errors: [],
    }));
    setParsedRows(validateRows(rows));
  }, [rawRows, colMap]);

  const processFile = useCallback((file: File) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'txt', 'tsv'].includes(ext || '')) {
      alert('Please upload a CSV file (.csv, .tsv, or .txt). To import from Excel, save your spreadsheet as CSV first.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const all = parseCSV(text);
      if (all.length < 2) {
        alert('File appears empty or has only a header row.');
        return;
      }
      const [hdrs, ...dataRows] = all;
      setHeaders(hdrs);
      setRawRows(dataRows);
      setColMap(buildColMap(hdrs));
      setStep('preview');
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invoice_import_sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const validRows = parsedRows.filter(r => r.errors.length === 0);
  const invalidRows = parsedRows.filter(r => r.errors.length > 0);

  const handleImport = async () => {
    if (validRows.length === 0) return;
    if (!defaultClientId && validRows.some(r => !r.clientName)) {
      alert('Please select a default client for rows that have no client name in the CSV.');
      return;
    }

    setImporting(true);
    setImportError('');
    setStep('importing');

    try {
      // Build invoice payloads
      const invoices = validRows.map(row => {
        const rawAmt = parseFloat(row.amount.replace(/[£$€,\s]/g, '')) || 0;
        const vatRate = row.vatRate ? parseFloat(row.vatRate) || defaultVatRate : defaultVatRate;
        // If VAT inclusive, back-calculate ex-VAT: price_ex = price_inc / (1 + vat/100)
        const unitPriceExVat = vatInclusive
          ? Math.round((rawAmt / (1 + vatRate / 100)) * 100) / 100
          : rawAmt;

        const payload: Record<string, unknown> = {
          client_id: defaultClientId || undefined,
          invoice_type: row.invoiceType || defaultInvoiceType,
          invoice_date: parseDate(row.date),
          items: [{
            item_type: 'other',
            description: row.description,
            quantity: 1,
            unit: 'unit',
            unit_price_ex_vat: unitPriceExVat,
            vat_rate: vatRate,
          }],
          notes: row.notes || undefined,
        };

        // If row has a client name and no default client, include it for server-side creation
        if (!defaultClientId && row.clientName) {
          payload.new_client_name = row.clientName;
        }

        return payload;
      });

      const result = await api.importInvoices(invoices) as ImportResult;
      setImportResult(result);
      setStep('done');
    } catch (err: any) {
      setImportError(err.message || 'Import failed. Please try again.');
      setStep('preview');
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setStep('upload');
    setHeaders([]);
    setRawRows([]);
    setParsedRows([]);
    setImportResult(null);
    setImportError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Import Invoices</h1>
            <p className="text-gray-600 mt-1">Import invoices from a CSV or spreadsheet file</p>
          </div>
          <Link
            href="/invoices"
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-sm">
          {(['upload', 'preview', 'done'] as const).map((s, idx) => {
            const labels = { upload: '1. Upload', preview: '2. Preview', done: '3. Done' };
            const current = step === s || (step === 'importing' && s === 'preview');
            const done = (step === 'preview' && idx === 0) ||
              (step === 'done' && idx < 2) ||
              (step === 'importing' && idx === 0);
            return (
              <div key={s} className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full font-medium ${
                  current ? 'bg-primary-600 text-white' :
                  done ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {labels[s]}
                </span>
                {idx < 2 && <span className="text-gray-300">→</span>}
              </div>
            );
          })}
        </div>

        {importError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
            {importError}
          </div>
        )}

        {/* ─── Step 1: Upload ─────────────────────────────────────────────── */}
        {step === 'upload' && (
          <div className="space-y-6">
            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                dragOver ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-lg font-medium text-gray-700">Drop your CSV file here</p>
                  <p className="text-sm text-gray-500 mt-1">or click to browse</p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
                >
                  Choose File
                </button>
                <p className="text-xs text-gray-400">Supports .csv, .tsv, .txt — For Excel, save as CSV first</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.tsv,.txt"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>

            {/* Expected format */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Expected Format</h2>
                <button
                  onClick={downloadSample}
                  className="px-3 py-1.5 text-sm text-primary-600 border border-primary-300 rounded-lg hover:bg-primary-50"
                >
                  Download Sample CSV
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Your CSV should have a header row. The following columns are supported:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-3 py-2 font-medium text-gray-700 border-b">Column</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-700 border-b">Required</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-700 border-b">Example</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-700 border-b">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="px-3 py-2 font-mono text-xs font-medium text-gray-900">date</td>
                      <td className="px-3 py-2"><span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">Required</span></td>
                      <td className="px-3 py-2 text-gray-600 font-mono text-xs">2026-01-15</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">ISO (YYYY-MM-DD), DD/MM/YYYY, or MM/DD/YYYY</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono text-xs font-medium text-gray-900">description</td>
                      <td className="px-3 py-2"><span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">Required</span></td>
                      <td className="px-3 py-2 text-gray-600 font-mono text-xs">Kitchen rewire</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">Line item description for the invoice</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono text-xs font-medium text-gray-900">amount</td>
                      <td className="px-3 py-2"><span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">Required</span></td>
                      <td className="px-3 py-2 text-gray-600 font-mono text-xs">500.00</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">Numeric, £/$/€ symbols are stripped automatically</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono text-xs font-medium text-gray-900">client_name</td>
                      <td className="px-3 py-2"><span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">Optional</span></td>
                      <td className="px-3 py-2 text-gray-600 font-mono text-xs">Acme Corp</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">If omitted, a default client must be selected</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono text-xs font-medium text-gray-900">vat_rate</td>
                      <td className="px-3 py-2"><span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">Optional</span></td>
                      <td className="px-3 py-2 text-gray-600 font-mono text-xs">20</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">Percentage, defaults to 20%</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono text-xs font-medium text-gray-900">notes</td>
                      <td className="px-3 py-2"><span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">Optional</span></td>
                      <td className="px-3 py-2 text-gray-600 font-mono text-xs">Completed on schedule</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">Invoice notes / memo</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono text-xs font-medium text-gray-900">type</td>
                      <td className="px-3 py-2"><span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">Optional</span></td>
                      <td className="px-3 py-2 text-gray-600 font-mono text-xs">final</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">final, deposit, progress, or credit_note</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── Step 2: Preview & Configure ────────────────────────────────── */}
        {step === 'preview' && (
          <div className="space-y-6">
            {/* Column mapping */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Column Mapping</h2>
              <p className="text-sm text-gray-600 mb-4">
                We detected {headers.length} column{headers.length !== 1 ? 's' : ''} in your file.
                Adjust the mapping if needed.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(Object.keys(colMap) as (keyof ColMap)[]).map(key => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {COL_LABELS[key]}
                      {(key === 'date' || key === 'description' || key === 'amount') && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </label>
                    <select
                      value={colMap[key]}
                      onChange={(e) => setColMap(prev => ({ ...prev, [key]: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value={-1}>— not mapped —</option>
                      {headers.map((h, i) => (
                        <option key={i} value={i}>{h} (col {i + 1})</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Import options */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Import Options</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Default client */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Client
                    {parsedRows.some(r => !r.clientName) && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </label>
                  <select
                    value={defaultClientId}
                    onChange={(e) => setDefaultClientId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">— use client_name column —</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.company ? ` (${c.company})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Applied to all rows (overrides client_name column)</p>
                </div>

                {/* Default invoice type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Invoice Type</label>
                  <select
                    value={defaultInvoiceType}
                    onChange={(e) => setDefaultInvoiceType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {TYPE_OPTIONS.map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1).replace('_', ' ')}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Used when the type column is absent or empty</p>
                </div>

                {/* Default VAT rate */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default VAT Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={defaultVatRate}
                    onChange={(e) => setDefaultVatRate(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Used when the vat_rate column is absent or empty</p>
                </div>

                {/* Amount type toggle */}
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Amount Column Interpretation</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="vatMode"
                        checked={!vatInclusive}
                        onChange={() => setVatInclusive(false)}
                        className="text-primary-600"
                      />
                      <span className="text-sm text-gray-700">Amounts are <strong>ex-VAT</strong> (VAT will be added on top)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="vatMode"
                        checked={vatInclusive}
                        onChange={() => setVatInclusive(true)}
                        className="text-primary-600"
                      />
                      <span className="text-sm text-gray-700">Amounts are <strong>inc-VAT</strong> (ex-VAT will be back-calculated)</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Validation summary */}
            {invalidRows.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="font-medium text-amber-800 text-sm">
                  {invalidRows.length} row{invalidRows.length !== 1 ? 's' : ''} have validation errors and will be skipped.
                  Fix them in your CSV and re-upload, or proceed to import only the valid rows.
                </p>
              </div>
            )}

            {/* Preview table */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  Preview — {parsedRows.length} row{parsedRows.length !== 1 ? 's' : ''} found
                </h2>
                <div className="flex gap-3 text-sm">
                  <span className="text-green-600 font-medium">{validRows.length} valid</span>
                  {invalidRows.length > 0 && (
                    <span className="text-red-600 font-medium">{invalidRows.length} invalid</span>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wider">Row</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wider">Date</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wider">Description</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wider">Amount</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wider">Client</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wider">VAT%</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedRows.map(row => {
                      const rawAmt = parseFloat(row.amount.replace(/[£$€,\s]/g, '')) || 0;
                      const vatRate = row.vatRate ? parseFloat(row.vatRate) || defaultVatRate : defaultVatRate;
                      const exVat = vatInclusive
                        ? Math.round((rawAmt / (1 + vatRate / 100)) * 100) / 100
                        : rawAmt;
                      const incVat = vatInclusive ? rawAmt : rawAmt * (1 + vatRate / 100);
                      const clientDisplay = defaultClientId
                        ? clients.find(c => c.id === defaultClientId)?.name || 'Selected client'
                        : row.clientName || <span className="text-red-500 text-xs">No client</span>;

                      return (
                        <tr key={row.rowNum} className={row.errors.length > 0 ? 'bg-red-50' : ''}>
                          <td className="px-4 py-3 text-gray-500 text-xs">{row.rowNum}</td>
                          <td className="px-4 py-3 text-gray-900">
                            {row.errors.some(e => e.includes('date')) ? (
                              <span className="text-red-500">{row.date || '—'}</span>
                            ) : (
                              parseDate(row.date) || row.date || '—'
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-900 max-w-xs truncate">
                            {row.errors.some(e => e.includes('description')) ? (
                              <span className="text-red-500">Missing</span>
                            ) : (
                              row.description || '—'
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {row.errors.some(e => e.includes('Amount')) ? (
                              <span className="text-red-500 text-xs">{row.amount || '—'}</span>
                            ) : (
                              <div>
                                <div className="font-medium text-gray-900">{formatCurrency(incVat)}</div>
                                <div className="text-xs text-gray-500">{formatCurrency(exVat)} ex-VAT</div>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{clientDisplay}</td>
                          <td className="px-4 py-3 text-right text-gray-600 text-xs">{vatRate}%</td>
                          <td className="px-4 py-3">
                            {row.errors.length === 0 ? (
                              <span className="inline-flex px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">Valid</span>
                            ) : (
                              <div>
                                <span className="inline-flex px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium mb-1">Skip</span>
                                {row.errors.map((err, i) => (
                                  <p key={i} className="text-red-500 text-xs">{err}</p>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pb-6">
              <button
                onClick={resetImport}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Upload Different File
              </button>
              <button
                onClick={handleImport}
                disabled={validRows.length === 0 || importing}
                className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
              >
                Import {validRows.length} Invoice{validRows.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}

        {/* ─── Step: Importing (progress) ─────────────────────────────────── */}
        {step === 'importing' && (
          <div className="bg-white shadow rounded-lg p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-lg font-medium text-gray-900">Importing invoices...</p>
            <p className="text-sm text-gray-500 mt-1">Please wait while your invoices are being created.</p>
          </div>
        )}

        {/* ─── Step 3: Done ───────────────────────────────────────────────── */}
        {step === 'done' && importResult && (
          <div className="space-y-6">
            {/* Summary */}
            <div className={`rounded-lg p-6 ${importResult.failed === 0 ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
              <h2 className={`text-xl font-bold mb-2 ${importResult.failed === 0 ? 'text-green-900' : 'text-amber-900'}`}>
                {importResult.failed === 0 ? 'Import Complete!' : 'Import Completed with Errors'}
              </h2>
              <div className="flex gap-6 text-sm mt-3">
                <div>
                  <span className="font-medium text-gray-700">Total rows: </span>
                  <span className="font-bold text-gray-900">{importResult.total}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Created: </span>
                  <span className="font-bold text-green-700">{importResult.succeeded}</span>
                </div>
                {importResult.failed > 0 && (
                  <div>
                    <span className="font-medium text-gray-700">Failed: </span>
                    <span className="font-bold text-red-700">{importResult.failed}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Results table */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Import Results</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wider">Row</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wider">Invoice #</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wider">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {importResult.results.map((r) => (
                      <tr key={r.row} className={!r.success ? 'bg-red-50' : ''}>
                        <td className="px-4 py-3 text-gray-500 text-xs">{r.row}</td>
                        <td className="px-4 py-3">
                          {r.success ? (
                            <span className="inline-flex px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">Created</span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">Failed</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-mono text-xs">
                          {r.invoice_number ? (
                            <Link href={`/invoices/${r.id}`} className="text-primary-600 hover:underline">
                              {r.invoice_number}
                            </Link>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{r.error || 'OK'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 pb-6">
              <Link
                href="/invoices"
                className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
              >
                View All Invoices
              </Link>
              <button
                onClick={resetImport}
                className="px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                Import Another File
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
