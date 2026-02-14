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
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between">
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

        {/* Actions Bar */}
        <div className="bg-white shadow rounded-lg p-4">
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
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium"
              >
                Print / PDF
              </button>
            </div>
          </div>
        </div>

        {/* Payment Status */}
        {parseFloat(invoice.amount_paid as any) > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
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
        <div className="grid grid-cols-2 gap-6">
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
        <div className="bg-white shadow rounded-lg overflow-hidden">
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
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
