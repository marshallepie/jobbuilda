'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatCurrency, formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

type ViewState = 'loading' | 'error' | 'quote' | 'invoice';

interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price_ex_vat: number;
  line_total_ex_vat: number;
  vat_rate: number;
  line_vat: number;
  line_total_inc_vat: number;
}

interface Quote {
  id: string;
  quote_number: string;
  title: string;
  status: string;
  subtotal_ex_vat: number;
  vat_amount: number;
  total_inc_vat: number;
  valid_until?: string;
  notes?: string;
  terms?: string;
  items?: QuoteItem[];
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price_ex_vat: string;
  line_total_ex_vat: string;
  vat_rate: string;
  line_vat: string;
  line_total_inc_vat: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  invoice_date: string;
  due_date: string;
  subtotal_ex_vat: string;
  vat_amount: string;
  total_inc_vat: string;
  amount_due: string;
  amount_paid: string;
  notes?: string;
  items?: InvoiceItem[];
}

function decodeToken(token: string): {
  tenant_id: string;
  user_id: string;
  purpose: string;
  resource_id: string;
  exp: number;
} | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch {
    return null;
  }
}

export default function ViewPage() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<ViewState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('No access token provided. Please use the link from your message.');
      setState('error');
      return;
    }

    const claims = decodeToken(token);
    if (!claims) {
      setError('Invalid link. Please use the link from your message.');
      setState('error');
      return;
    }

    if (claims.exp * 1000 < Date.now()) {
      setError('This link has expired. Please ask for a new one.');
      setState('error');
      return;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-tenant-id': claims.tenant_id,
      'x-user-id': claims.user_id,
    };

    const load = async () => {
      try {
        if (claims.purpose === 'quote_view') {
          const res = await fetch(
            `${API_BASE_URL}/api/quotes/${claims.resource_id}`,
            { headers }
          );
          if (!res.ok) throw new Error('Could not load quote');
          const data: Quote = await res.json();
          setQuote(data);
          setState('quote');
        } else if (claims.purpose === 'invoice_payment') {
          const res = await fetch(
            `${API_BASE_URL}/api/invoices/${claims.resource_id}`,
            { headers }
          );
          if (!res.ok) throw new Error('Could not load invoice');
          const data: Invoice = await res.json();
          setInvoice(data);
          setState('invoice');
        } else {
          setError('This link type is not supported for web viewing.');
          setState('error');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load document. Please try again.');
        setState('error');
      }
    };

    load();
  }, [searchParams]);

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4" />
          <p className="text-gray-600">Loading your document…</p>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-md p-8 max-w-md w-full text-center">
          <svg className="h-12 w-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Link unavailable</h2>
          <p className="text-gray-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (state === 'quote' && quote) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-1">
                  {quote.quote_number}
                </p>
                <h1 className="text-2xl font-bold text-gray-900">{quote.title}</h1>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                quote.status === 'approved' ? 'bg-green-100 text-green-800' :
                quote.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {quote.status}
              </span>
            </div>
            {quote.valid_until && (
              <p className="text-sm text-gray-500">Valid until {formatDate(quote.valid_until)}</p>
            )}
          </div>

          {/* Line items */}
          {quote.items && quote.items.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Items</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="pb-2 font-medium">Description</th>
                      <th className="pb-2 font-medium text-right">Qty</th>
                      <th className="pb-2 font-medium text-right">Unit price</th>
                      <th className="pb-2 font-medium text-right">Total (ex VAT)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {quote.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-3 text-gray-900">{item.description}</td>
                        <td className="py-3 text-right text-gray-600">{item.quantity} {item.unit}</td>
                        <td className="py-3 text-right text-gray-600">{formatCurrency(item.unit_price_ex_vat)}</td>
                        <td className="py-3 text-right font-medium">{formatCurrency(item.line_total_ex_vat)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
            <div className="space-y-2 max-w-xs ml-auto">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal (ex VAT)</span>
                <span>{formatCurrency(quote.subtotal_ex_vat)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>VAT</span>
                <span>{formatCurrency(quote.vat_amount)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-2">
                <span>Total</span>
                <span>{formatCurrency(quote.total_inc_vat)}</span>
              </div>
            </div>
          </div>

          {/* Notes / Terms */}
          {(quote.notes || quote.terms) && (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-4 space-y-3">
              {quote.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Notes</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{quote.notes}</p>
                </div>
              )}
              {quote.terms && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Terms &amp; Conditions</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{quote.terms}</p>
                </div>
              )}
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-6">
            Powered by JobBuilda · This link expires in 7 days
          </p>
        </div>
      </div>
    );
  }

  if (state === 'invoice' && invoice) {
    const amountDue = parseFloat(invoice.amount_due as any);
    const isPaid = amountDue <= 0 || invoice.status === 'paid';

    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-1">
                  {invoice.invoice_number}
                </p>
                <h1 className="text-2xl font-bold text-gray-900">Invoice</h1>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                isPaid ? 'bg-green-100 text-green-800' :
                invoice.status === 'overdue' ? 'bg-red-100 text-red-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {isPaid ? 'Paid' : invoice.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium text-gray-700">Invoice date:</span>{' '}
                {formatDate(invoice.invoice_date)}
              </div>
              <div>
                <span className="font-medium text-gray-700">Due date:</span>{' '}
                {formatDate(invoice.due_date)}
              </div>
            </div>
          </div>

          {/* Line items */}
          {invoice.items && invoice.items.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Items</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="pb-2 font-medium">Description</th>
                      <th className="pb-2 font-medium text-right">Qty</th>
                      <th className="pb-2 font-medium text-right">Unit price</th>
                      <th className="pb-2 font-medium text-right">Total (ex VAT)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invoice.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-3 text-gray-900">{item.description}</td>
                        <td className="py-3 text-right text-gray-600">{item.quantity} {item.unit}</td>
                        <td className="py-3 text-right text-gray-600">{formatCurrency(item.unit_price_ex_vat)}</td>
                        <td className="py-3 text-right font-medium">{formatCurrency(item.line_total_ex_vat)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
            <div className="space-y-2 max-w-xs ml-auto">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal (ex VAT)</span>
                <span>{formatCurrency(invoice.subtotal_ex_vat)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>VAT</span>
                <span>{formatCurrency(invoice.vat_amount)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-2">
                <span>Total</span>
                <span>{formatCurrency(invoice.total_inc_vat)}</span>
              </div>
              {parseFloat(invoice.amount_paid as any) > 0 && (
                <div className="flex justify-between text-sm text-green-700">
                  <span>Paid</span>
                  <span>-{formatCurrency(invoice.amount_paid)}</span>
                </div>
              )}
              {!isPaid && (
                <div className="flex justify-between text-base font-bold text-red-700 border-t border-gray-200 pt-2">
                  <span>Amount due</span>
                  <span>{formatCurrency(invoice.amount_due)}</span>
                </div>
              )}
            </div>
          </div>

          {invoice.notes && (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Notes</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-6">
            Powered by JobBuilda · This link expires in 7 days
          </p>
        </div>
      </div>
    );
  }

  return null;
}
