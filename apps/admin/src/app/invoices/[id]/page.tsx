'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';

interface InvoiceItem {
  id: string;
  item_type: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price_ex_vat: number;
  line_total_ex_vat: number;
  vat_rate: number;
  line_vat: number;
  line_total_inc_vat: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  job_id: string;
  client_id: string;
  site_id: string;
  invoice_type: string;
  status: string;
  invoice_date: string;
  due_date: string;
  subtotal_ex_vat: number;
  vat_amount: number;
  total_inc_vat: number;
  amount_paid: number;
  amount_due: number;
  notes?: string;
  created_at: string;
  sent_at?: string;
  paid_at?: string;
  items?: InvoiceItem[];
  client_name?: string;
  site_name?: string;
  site_address?: string;
}

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params?.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer',
    payment_reference: '',
    notes: '',
  });

  useEffect(() => {
    if (invoiceId) {
      loadInvoice();
    }
  }, [invoiceId]);

  const loadInvoice = async () => {
    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      const response = await api.request(`/api/invoices/${invoiceId}`) as any;
      const data = response.data || response;

      // Fetch client details
      if (data.client_id) {
        try {
          const clientData = await api.request(`/api/clients/clients/${data.client_id}`) as any;
          data.client_name = clientData.name;
        } catch (err) {
          console.error('Failed to load client:', err);
        }
      }

      // Fetch site details
      if (data.site_id) {
        try {
          const siteData = await api.request(`/api/clients/sites/${data.site_id}`) as any;
          data.site_name = siteData.name;
          data.site_address = [
            siteData.address_line1,
            siteData.address_line2,
            siteData.city,
            siteData.county,
            siteData.postcode
          ].filter(Boolean).join(', ');
        } catch (err) {
          console.error('Failed to load site:', err);
        }
      }

      setInvoice(data);
    } catch (err) {
      console.error('Failed to load invoice:', err);
    } finally {
      setLoading(false);
    }
  };

  const sendInvoice = async () => {
    if (!invoice) return;

    if (confirm(`Send invoice ${invoice.invoice_number} to client?`)) {
      setActionLoading(true);
      try {
        await api.sendInvoice(invoiceId);
        await loadInvoice();
        alert('Invoice sent successfully!');
      } catch (err) {
        console.error('Failed to send invoice:', err);
        alert('Failed to send invoice. Please try again.');
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!invoice || !paymentForm.amount) {
      alert('Please enter a payment amount');
      return;
    }

    const amount = parseFloat(paymentForm.amount);
    if (amount <= 0 || amount > parseFloat(invoice.amount_due as any)) {
      alert(`Payment amount must be between £0 and £${invoice.amount_due.toFixed(2)}`);
      return;
    }

    setActionLoading(true);
    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      await api.request(`/api/invoices/${invoiceId}/payment`, {
        method: 'POST',
        body: JSON.stringify({
          amount: amount,
          payment_date: paymentForm.payment_date,
          payment_method: paymentForm.payment_method,
          payment_reference: paymentForm.payment_reference || undefined,
          notes: paymentForm.notes || undefined,
        }),
      });

      setPaymentForm({
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'bank_transfer',
        payment_reference: '',
        notes: '',
      });
      setShowPaymentForm(false);
      await loadInvoice();
      alert('Payment recorded successfully!');
    } catch (err: any) {
      console.error('Failed to record payment:', err);
      alert(err.message || 'Failed to record payment. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </AppLayout>
    );
  }

  if (!invoice) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invoice Not Found</h2>
          <p className="text-gray-600 mb-6">The invoice you're looking for doesn't exist.</p>
          <Link
            href="/invoices"
            className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Back to Invoices
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <style jsx global>{`
        @media print {
          /* Hide navigation, sidebar, and non-invoice elements */
          aside, nav, header, .no-print,
          button, .hamburger-menu,
          [class*="menu"], [class*="nav"],
          img[alt*="logo"], .logo {
            display: none !important;
          }

          /* Hide AppLayout wrapper elements */
          body > div:first-child,
          #__next > div:first-child {
            background: white !important;
          }

          /* Reset page margins to minimum */
          @page {
            margin: 10mm;
          }

          body {
            margin: 0;
            padding: 0;
          }

          html, body {
            width: 210mm;
            height: 297mm;
          }

          /* Make print content full width and compact */
          .print-content {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 10mm !important;
          }

          /* Reduce spacing between sections for print */
          .print-content > div {
            margin-bottom: 8px !important;
          }

          .space-y-6 > * + * {
            margin-top: 0.5rem !important;
          }

          /* Make invoice sections more compact */
          .invoice-section {
            padding: 0.75rem !important;
            margin-bottom: 0.5rem !important;
          }

          /* Reduce padding in cards/boxes */
          .p-4, .p-6 {
            padding: 0.5rem !important;
          }

          /* Compact grid spacing */
          .gap-6 {
            gap: 0.5rem !important;
          }

          /* Ensure tables fit within page */
          table {
            width: 100%;
            table-layout: fixed;
          }

          /* Make columns responsive in print */
          .grid {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 1rem !important;
          }

          /* Ensure proper page breaks */
          .invoice-section {
            page-break-inside: avoid;
          }

          /* Remove shadows and adjust colors for print */
          .shadow, .rounded-lg {
            box-shadow: none !important;
          }

          /* Hide any fixed/absolute positioned elements */
          [style*="position: fixed"],
          [style*="position: absolute"],
          .fixed, .absolute {
            display: none !important;
          }

          /* Print-specific header styling - more compact */
          .print-header {
            border-bottom: 2px solid #000;
            padding-bottom: 8px;
            margin-bottom: 12px;
          }

          /* Reduce header spacing */
          .mb-8 {
            margin-bottom: 0.75rem !important;
          }

          .mb-6 {
            margin-bottom: 0.5rem !important;
          }

          .mt-6 {
            margin-top: 0.5rem !important;
          }

          /* Make text slightly smaller for better fit */
          .text-4xl {
            font-size: 1.75rem !important;
          }

          .text-3xl {
            font-size: 1.5rem !important;
          }

          .text-xl {
            font-size: 1.125rem !important;
          }

          /* Ensure text is readable */
          * {
            color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Table styling for print - more compact */
          table {
            border-collapse: collapse;
            width: 100%;
            margin: 0.5rem 0;
          }

          th, td {
            border: 1px solid #ddd;
            padding: 4px 6px !important;
            font-size: 0.875rem;
          }

          thead th {
            padding: 6px !important;
          }

          /* Reduce table row height */
          tbody tr {
            line-height: 1.2;
          }

          th {
            background-color: #f3f4f6 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
      <div className="space-y-6 max-w-5xl print-content">
        {/* Header - Screen Only */}
        <div className="flex items-center justify-between no-print">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{invoice.invoice_number}</h1>
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(invoice.status)}`}>
                {invoice.status}
              </span>
              <span className="px-3 py-1 text-sm font-medium rounded-full bg-purple-100 text-purple-800">
                {invoice.invoice_type}
              </span>
            </div>
            <p className="text-lg text-gray-600">
              Invoice Date: {formatDate(invoice.invoice_date)} • Due: {formatDate(invoice.due_date)}
            </p>
          </div>
          <Link
            href="/invoices"
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Back to Invoices
          </Link>
        </div>

        {/* Header - Print Only */}
        <div className="hidden print:block mb-8">
          <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">INVOICE</h1>
              <p className="text-xl font-semibold">{invoice.invoice_number}</p>
              <p className="text-sm text-gray-600 mt-2">
                Invoice Type: <span className="font-medium capitalize">{invoice.invoice_type}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold text-lg mb-2">JobBuilda Ltd</p>
              <p className="text-sm text-gray-600">123 Business Street</p>
              <p className="text-sm text-gray-600">London, UK</p>
              <p className="text-sm text-gray-600 mt-2">Email: info@jobbuilda.com</p>
              <p className="text-sm text-gray-600">Tel: +44 123 456 7890</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6 mb-6">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">Invoice Date:</p>
              <p className="text-base">{formatDate(invoice.invoice_date)}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">Due Date:</p>
              <p className="text-base">{formatDate(invoice.due_date)}</p>
            </div>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="bg-white shadow rounded-lg p-4 no-print">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Created {formatDate(invoice.created_at)}
              {invoice.sent_at && ` • Sent ${formatDate(invoice.sent_at)}`}
              {invoice.paid_at && ` • Paid ${formatDate(invoice.paid_at)}`}
            </div>
            <div className="flex gap-2">
              {invoice.status === 'draft' && (
                <button
                  onClick={sendInvoice}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 text-sm font-medium"
                >
                  {actionLoading ? 'Sending...' : 'Send to Client'}
                </button>
              )}
              {(invoice.status === 'sent' || invoice.status === 'viewed' || invoice.status === 'partial' || invoice.status === 'overdue') && parseFloat(invoice.amount_due as any) > 0 && (
                <button
                  onClick={() => setShowPaymentForm(!showPaymentForm)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                >
                  {showPaymentForm ? '✕ Cancel' : '💰 Record Payment'}
                </button>
              )}
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium"
              >
                Print / PDF
              </button>
            </div>
          </div>
        </div>

        {/* Payment Form */}
        {showPaymentForm && (
          <div className="bg-white shadow rounded-lg p-6 no-print">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Record Payment</h2>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Amount (£) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={invoice.amount_due}
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    required
                    placeholder={`Max: ${formatCurrency(invoice.amount_due)}`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Outstanding: {formatCurrency(invoice.amount_due)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Method <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={paymentForm.payment_method}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                    <option value="card">Card</option>
                    <option value="stripe">Stripe</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Reference
                  </label>
                  <input
                    type="text"
                    value={paymentForm.payment_reference}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_reference: e.target.value })}
                    placeholder="e.g., Transaction ID, Cheque number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  placeholder="Additional notes about this payment..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                >
                  {actionLoading ? 'Recording...' : 'Record Payment'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPaymentForm(false)}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Payment Status */}
        {parseFloat(invoice.amount_paid as any) > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 invoice-section">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold text-green-900">Payment Received</p>
                <p className="text-sm text-green-700">
                  {formatCurrency(invoice.amount_paid)} of {formatCurrency(invoice.total_inc_vat)} paid
                </p>
              </div>
              {parseFloat(invoice.amount_due as any) > 0 && (
                <div className="text-right">
                  <p className="text-sm text-green-700">Amount Due</p>
                  <p className="text-2xl font-bold text-green-900">{formatCurrency(invoice.amount_due)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Client & Site Info */}
        <div className="grid grid-cols-2 gap-6 invoice-section">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Client Details</h2>
            <div className="space-y-2 text-sm">
              <p className="font-medium text-gray-900">{invoice.client_name}</p>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Site Location</h2>
            <div className="space-y-2 text-sm">
              <p className="font-medium text-gray-900">{invoice.site_name}</p>
              {invoice.site_address && <p className="text-gray-600">{invoice.site_address}</p>}
            </div>
          </div>
        </div>

        {/* Invoice Items */}
        <div className="bg-white shadow rounded-lg overflow-hidden invoice-section">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Invoice Items</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoice.items?.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{item.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700">
                        {item.item_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-600">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-600">
                      {formatCurrency(item.unit_price_ex_vat)}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {formatCurrency(item.line_total_inc_vat)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatCurrency(item.line_total_ex_vat)} + VAT
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal (ex VAT)</span>
                  <span className="font-medium">{formatCurrency(invoice.subtotal_ex_vat)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">VAT</span>
                  <span className="font-medium">{formatCurrency(invoice.vat_amount)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-300">
                  <span className="text-base font-semibold text-gray-900">Total (inc VAT)</span>
                  <span className="text-xl font-bold text-gray-900">{formatCurrency(invoice.total_inc_vat)}</span>
                </div>
                {parseFloat(invoice.amount_paid as any) > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Amount Paid</span>
                      <span className="font-medium">-{formatCurrency(invoice.amount_paid)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-300">
                      <span className="text-base font-semibold text-gray-900">Amount Due</span>
                      <span className="text-xl font-bold text-red-600">{formatCurrency(invoice.amount_due)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="bg-white shadow rounded-lg p-6 invoice-section">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
