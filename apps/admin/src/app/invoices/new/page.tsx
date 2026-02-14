'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface Quote {
  id: string;
  quote_number: string;
  title: string;
  client_id: string;
  site_id: string;
  subtotal_ex_vat: number;
  vat_amount: number;
  total_inc_vat: number;
  items?: any[];
}

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quoteId = searchParams?.get('quote_id');

  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [depositPercent, setDepositPercent] = useState(30);

  useEffect(() => {
    if (quoteId) {
      loadQuote();
    } else {
      setLoading(false);
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
      setQuote(data);
    } catch (err) {
      console.error('Failed to load quote:', err);
      alert('Failed to load quote. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const createDepositInvoice = async () => {
    if (!quote) return;

    if (!confirm(`Create ${depositPercent}% deposit invoice for quote ${quote.quote_number}?`)) {
      return;
    }

    setCreating(true);
    try {
      // Step 1: Create job from quote
      const job = await api.request('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({
          quote_id: quote.id,
          client_id: quote.client_id,
          site_id: quote.site_id,
          title: quote.title,
          description: `Job created from quote ${quote.quote_number}`,
        }),
      }) as any;

      // Step 2: Calculate deposit amount and create invoice items
      const depositMultiplier = depositPercent / 100;
      const depositItems = quote.items?.map(item => ({
        item_type: item.item_type,
        description: `${item.description} (${depositPercent}% deposit)`,
        quantity: parseFloat(item.quantity) * depositMultiplier,
        unit: item.unit,
        unit_price_ex_vat: parseFloat(item.unit_price_ex_vat),
        vat_rate: parseFloat(item.vat_rate || '20'),
      })) || [];

      // Step 3: Create deposit invoice
      const invoice = await api.request('/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          job_id: job.job_id,
          client_id: quote.client_id,
          site_id: quote.site_id,
          invoice_type: 'deposit',
          items: depositItems,
          notes: `${depositPercent}% deposit invoice for quote ${quote.quote_number}`,
        }),
      }) as any;

      alert(`Deposit invoice ${invoice.invoice_number} created successfully!`);
      router.push(`/invoices/${invoice.id}`);
    } catch (err: any) {
      console.error('Failed to create invoice:', err);
      alert(err.message || 'Failed to create deposit invoice. Please try again.');
    } finally {
      setCreating(false);
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

  if (!quoteId || !quote) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Quote Selected</h2>
          <p className="text-gray-600 mb-6">Please select an approved quote to create a deposit invoice.</p>
          <Link
            href="/quotes"
            className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Go to Quotes
          </Link>
        </div>
      </AppLayout>
    );
  }

  const depositAmount = (parseFloat(quote.total_inc_vat as any) * depositPercent) / 100;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Create Deposit Invoice</h1>
            <p className="text-gray-600 mt-1">From quote {quote.quote_number}</p>
          </div>
          <Link
            href={`/quotes/${quoteId}`}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Back to Quote
          </Link>
        </div>

        {/* Quote Summary */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quote Summary</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Quote Number:</span>
              <span className="font-medium">{quote.quote_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Title:</span>
              <span className="font-medium">{quote.title}</span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="text-gray-600">Total Amount (inc VAT):</span>
              <span className="text-xl font-bold text-gray-900">
                {formatCurrency(quote.total_inc_vat)}
              </span>
            </div>
          </div>
        </div>

        {/* Deposit Configuration */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Deposit Configuration</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deposit Percentage
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={depositPercent}
                  onChange={(e) => setDepositPercent(parseInt(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="w-20 text-right">
                  <span className="text-2xl font-bold text-primary-600">{depositPercent}%</span>
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>10%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600">Deposit Invoice Amount</p>
                  <p className="text-xs text-gray-500 mt-1">
                    This invoice will request {depositPercent}% of the total quote value
                  </p>
                </div>
                <div className="text-3xl font-bold text-green-600">
                  {formatCurrency(depositAmount)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Items Preview */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice Items Preview</h2>
          <div className="text-sm text-gray-600 mb-3">
            The following items will be included at {depositPercent}% of their quoted quantities:
          </div>
          <div className="space-y-2">
            {quote.items?.map((item, idx) => (
              <div key={idx} className="flex justify-between py-2 border-b border-gray-100">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{item.description}</p>
                  <p className="text-xs text-gray-500">
                    {item.item_type} • {parseFloat(item.quantity) * (depositPercent / 100)} {item.unit}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    {formatCurrency((parseFloat(item.line_total_inc_vat) * depositPercent) / 100)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link
            href={`/quotes/${quoteId}`}
            className="px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
          >
            Cancel
          </Link>
          <button
            onClick={createDepositInvoice}
            disabled={creating}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
          >
            {creating ? 'Creating Invoice...' : 'Create Deposit Invoice'}
          </button>
        </div>

        {/* Info Notice */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <strong>What happens next:</strong> This will create a job from the quote and generate
            a deposit invoice for {depositPercent}% of the total amount. The invoice will be in draft
            status and can be reviewed before sending to the client.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
