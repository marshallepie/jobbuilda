'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';

interface QuoteItem {
  id: string;
  item_type: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price_ex_vat: number;
  markup_percent: number;
  line_total_ex_vat: number;
  estimated_hours?: number;
  labor_rate?: number;
  vat_rate: number;
  line_vat: number;
  line_total_inc_vat: number;
  notes?: string;
}

interface Quote {
  id: string;
  quote_number: string;
  title: string;
  description?: string;
  status: string;
  subtotal_ex_vat: number;
  vat_amount: number;
  total_inc_vat: number;
  valid_until?: string;
  terms?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  sent_at?: string;
  approved_at?: string;
  client_name?: string;
  site_name?: string;
  site_address?: string;
  items?: QuoteItem[];
}

export default function QuoteDetailPage() {
  const router = useRouter();
  const params = useParams();
  const quoteId = params?.id as string;

  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (quoteId) {
      loadQuote();
    }
  }, [quoteId]);

  const loadQuote = async () => {
    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      const data = await api.request(`/api/quotes/${quoteId}`) as any;

      // Fetch client details if client_id exists
      if (data.client_id) {
        try {
          const clientData = await api.request(`/api/clients/clients/${data.client_id}`) as any;
          data.client_name = clientData.name;
        } catch (err) {
          console.error('Failed to load client:', err);
        }
      }

      // Fetch site details if site_id exists
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

      setQuote(data);
    } catch (err) {
      console.error('Failed to load quote:', err);
    } finally {
      setLoading(false);
    }
  };

  const sendQuote = async () => {
    if (!quote) return;

    if (confirm(`Send quote ${quote.quote_number} to client?`)) {
      setActionLoading(true);
      try {
        await api.sendQuote(quoteId);
        await loadQuote();
        alert('Quote sent successfully!');
      } catch (err) {
        console.error('Failed to send quote:', err);
        alert('Failed to send quote. Please try again.');
      } finally {
        setActionLoading(false);
      }
    }
  };

  const approveQuote = async () => {
    if (!quote) return;

    if (confirm(`Approve quote ${quote.quote_number}? This will allow deposit invoice generation.`)) {
      setActionLoading(true);
      try {
        await api.request(`/api/quotes/${quoteId}/approve`, {
          method: 'POST',
          body: JSON.stringify({}),
        });
        await loadQuote();
        alert('Quote approved! You can now generate a deposit invoice.');
      } catch (err) {
        console.error('Failed to approve quote:', err);
        alert('Failed to approve quote. Please try again.');
      } finally {
        setActionLoading(false);
      }
    }
  };

  const deleteQuote = async () => {
    if (!quote) return;

    if (confirm(`Are you sure you want to delete quote ${quote.quote_number}? This action cannot be undone.`)) {
      setActionLoading(true);
      try {
        await api.request(`/api/quotes/${quoteId}`, {
          method: 'DELETE',
        });
        router.push('/quotes');
      } catch (err: any) {
        console.error('Failed to delete quote:', err);
        alert(err.message || 'Failed to delete quote. Please try again.');
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

  if (!quote) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Quote Not Found</h2>
          <p className="text-gray-600 mb-6">The quote you're looking for doesn't exist.</p>
          <Link
            href="/quotes"
            className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Back to Quotes
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
              <h1 className="text-3xl font-bold text-gray-900">{quote.quote_number}</h1>
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(quote.status)}`}>
                {quote.status}
              </span>
            </div>
            <p className="text-lg text-gray-600">{quote.title}</p>
          </div>
          <Link
            href="/quotes"
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Back to Quotes
          </Link>
        </div>

        {/* Actions Bar */}
        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Created {formatDate(quote.created_at)}
              {quote.sent_at && ` • Sent ${formatDate(quote.sent_at)}`}
              {quote.approved_at && ` • Approved ${formatDate(quote.approved_at)}`}
            </div>
            <div className="flex gap-2">
              {quote.status === 'draft' && (
                <>
                  <button
                    onClick={() => router.push(`/quotes/${quoteId}/edit`)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={sendQuote}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 text-sm font-medium"
                  >
                    {actionLoading ? 'Sending...' : 'Send to Client'}
                  </button>
                </>
              )}
              {(quote.status === 'sent' || quote.status === 'viewed') && (
                <button
                  onClick={approveQuote}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                >
                  {actionLoading ? 'Approving...' : 'Approve Quote'}
                </button>
              )}
              {quote.status === 'approved' && (
                <button
                  onClick={() => router.push(`/invoices/new?quote_id=${quoteId}`)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                >
                  Generate Deposit Invoice
                </button>
              )}
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium"
              >
                Print / PDF
              </button>
              {quote.status !== 'approved' && (
                <button
                  onClick={deleteQuote}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
                >
                  {actionLoading ? 'Deleting...' : 'Delete Quote'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Client & Site Info */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Client Details</h2>
            <div className="space-y-2 text-sm">
              <p className="font-medium text-gray-900">{quote.client_name}</p>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Site Location</h2>
            <div className="space-y-2 text-sm">
              <p className="font-medium text-gray-900">{quote.site_name}</p>
              {quote.site_address && <p className="text-gray-600">{quote.site_address}</p>}
            </div>
          </div>
        </div>

        {/* Quote Details */}
        {quote.description && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Description</h2>
            <p className="text-gray-700">{quote.description}</p>
          </div>
        )}

        {/* Quote Items */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Quote Items</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Details</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {quote.items?.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{item.description}</div>
                      {item.notes && <div className="text-xs text-gray-500 italic">{item.notes}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700">
                        {item.item_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-600">
                      {item.item_type === 'labor' ? (
                        <div>
                          {item.estimated_hours}hrs × £{item.labor_rate}/hr
                        </div>
                      ) : (
                        <div>
                          {item.quantity} {item.unit} × {formatCurrency(item.unit_price_ex_vat)}
                          {item.markup_percent > 0 && ` (+${item.markup_percent}%)`}
                        </div>
                      )}
                      <div className="text-xs text-gray-500">
                        + {item.vat_rate}% VAT
                      </div>
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
                  <span className="font-medium">{formatCurrency(quote.subtotal_ex_vat)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">VAT</span>
                  <span className="font-medium">{formatCurrency(quote.vat_amount)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-300">
                  <span className="text-base font-semibold text-gray-900">Total (inc VAT)</span>
                  <span className="text-xl font-bold text-gray-900">{formatCurrency(quote.total_inc_vat)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Terms & Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {quote.terms && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Terms & Conditions</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{quote.terms}</p>
            </div>
          )}

          {quote.notes && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Internal Notes</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <strong>Important Note:</strong> This quote is an estimate of the work pricing.
            The exact time required to complete the job satisfactorily cannot be determined
            before the work has commenced. Final costs may vary based on actual time spent,
            unforeseen complications, or additional materials required.
          </p>
        </div>

        {quote.valid_until && (
          <div className="text-center text-sm text-gray-500">
            This quote is valid until {formatDate(quote.valid_until)}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
