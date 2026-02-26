'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface LineItem {
  item_type: 'labor' | 'material' | 'variation' | 'other';
  description: string;
  quantity: string;
  unit: string;
  unit_price_ex_vat: string;
  vat_rate: string;
}

const blankItem = (vatRate = 20): LineItem => ({
  item_type: 'labor',
  description: '',
  quantity: '1',
  unit: 'unit',
  unit_price_ex_vat: '0',
  vat_rate: String(vatRate),
});

export default function EditInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params?.id as string;

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentTermsDays, setPaymentTermsDays] = useState(30);
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([blankItem()]);
  const [defaultVatRate, setDefaultVatRate] = useState(20);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (invoiceId) loadInvoice();
  }, [invoiceId]);

  const loadInvoice = async () => {
    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      const [invoiceData, profileData] = await Promise.all([
        api.request(`/api/invoices/${invoiceId}`) as any,
        api.request('/api/identity/profile').catch(() => null) as any,
      ]);

      const data = invoiceData.data || invoiceData;
      setInvoiceNumber(data.invoice_number || '');
      setInvoiceStatus(data.status || '');
      setInvoiceDate(data.invoice_date || new Date().toISOString().split('T')[0]);
      setPaymentTermsDays(data.payment_terms_days || 30);
      setNotes(data.notes || '');

      const profile = profileData?.data || profileData;
      const vatRate = profile?.default_vat_rate ?? 20;
      setDefaultVatRate(vatRate);

      if (data.items && data.items.length > 0) {
        setLineItems(data.items.map((item: any) => ({
          item_type: item.item_type || 'other',
          description: item.description || '',
          quantity: String(item.quantity || 1),
          unit: item.unit || 'unit',
          unit_price_ex_vat: String(item.unit_price_ex_vat || 0),
          vat_rate: String(item.vat_rate ?? vatRate),
        })));
      }
    } catch (err) {
      console.error('Failed to load invoice:', err);
      setError('Failed to load invoice.');
    } finally {
      setLoading(false);
    }
  };

  const calcItemTotal = (item: LineItem) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unit_price_ex_vat) || 0;
    const vat = parseFloat(item.vat_rate) || 0;
    const exVat = qty * price;
    return exVat + exVat * (vat / 100);
  };

  const totals = lineItems.reduce(
    (acc, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price_ex_vat) || 0;
      const vat = parseFloat(item.vat_rate) || 0;
      const exVat = qty * price;
      acc.subtotal += exVat;
      acc.vat += exVat * (vat / 100);
      return acc;
    },
    { subtotal: 0, vat: 0 }
  );

  const updateItem = (idx: number, field: keyof LineItem, value: string) => {
    setLineItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const addItem = () => setLineItems(prev => [...prev, blankItem(defaultVatRate)]);
  const removeItem = (idx: number) => setLineItems(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (lineItems.some(item => !item.description.trim())) {
      setError('All items must have a description.');
      return;
    }

    setSaving(true);
    try {
      const items = lineItems.map(item => ({
        item_type: item.item_type,
        description: item.description.trim(),
        quantity: parseFloat(item.quantity),
        unit: item.unit.trim() || 'unit',
        unit_price_ex_vat: parseFloat(item.unit_price_ex_vat),
        vat_rate: parseFloat(item.vat_rate) || defaultVatRate,
      }));

      await api.request(`/api/invoices/${invoiceId}`, {
        method: 'PUT',
        body: JSON.stringify({
          invoice_date: invoiceDate,
          payment_terms_days: paymentTermsDays,
          notes: notes || undefined,
          items,
        }),
      });

      router.push(`/invoices/${invoiceId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to save invoice. Please try again.');
    } finally {
      setSaving(false);
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

  if (invoiceStatus && invoiceStatus !== 'draft') {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invoice Cannot Be Edited</h2>
          <p className="text-gray-600 mb-6">
            Invoice {invoiceNumber} has status <strong>{invoiceStatus}</strong> and can no longer be edited.
          </p>
          <Link href={`/invoices/${invoiceId}`} className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
            Back to Invoice
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl space-y-6">
        {/* Header */}
        <div>
          <Link href={`/invoices/${invoiceId}`} className="text-rose-600 hover:text-rose-700 text-sm mb-2 inline-block">
            ← Back to Invoice
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Edit Invoice {invoiceNumber}</h1>
          <p className="text-gray-500 text-sm mt-1">Changes will update the draft invoice.</p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Invoice Details */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms (days)</label>
                <input
                  type="number"
                  min="0"
                  value={paymentTermsDays}
                  onChange={(e) => setPaymentTermsDays(parseInt(e.target.value) || 30)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Internal notes or payment instructions..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Line Items</h2>
              <button
                type="button"
                onClick={addItem}
                className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-md hover:bg-primary-700"
              >
                + Add Item
              </button>
            </div>

            <div className="space-y-4">
              {lineItems.map((item, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">Item {idx + 1}</span>
                    {lineItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="sm:col-span-2 md:col-span-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(idx, 'description', e.target.value)}
                        required
                        placeholder="Item description"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                      <select
                        value={item.item_type}
                        onChange={(e) => updateItem(idx, 'item_type', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="labor">Labour</option>
                        <option value="material">Material</option>
                        <option value="variation">Variation</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                        placeholder="unit"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Unit Price (ex VAT) £</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price_ex_vat}
                        onChange={(e) => updateItem(idx, 'unit_price_ex_vat', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">VAT Rate %</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.vat_rate}
                        onChange={(e) => updateItem(idx, 'vat_rate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div className="flex items-end">
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Total: </span>
                        <span className="font-semibold text-gray-900">{formatCurrency(calcItemTotal(item))}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="mt-6 flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal (ex VAT)</span>
                  <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">VAT</span>
                  <span className="font-medium">{formatCurrency(totals.vat)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-300">
                  <span className="text-base font-semibold">Total (inc VAT)</span>
                  <span className="text-xl font-bold text-gray-900">{formatCurrency(totals.subtotal + totals.vat)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <Link
              href={`/invoices/${invoiceId}`}
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
