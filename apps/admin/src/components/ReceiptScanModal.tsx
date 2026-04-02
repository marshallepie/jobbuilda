'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '@/lib/api';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface LineItemDraft {
  item_type: 'other';
  description: string;
  quantity: number;
  unit: string;
  unit_price_ex_vat: number;
  vat_rate: number;
  receipt_url?: string;
}

interface ScannedResult {
  supplier_name: string | null;
  date: string | null;
  items: Array<{
    description: string;
    quantity: number;
    unit_price_ex_vat: number;
    vat_rate: number;
  }>;
  subtotal_ex_vat: number | null;
  vat_amount: number | null;
  total_inc_vat: number | null;
}

interface DraftInvoice {
  id: string;
  invoice_number: string;
}

interface ReceiptScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** If provided, skip the invoice-picker step and add items directly */
  invoiceId?: string;
  onItemsConfirmed: (items: LineItemDraft[]) => void;
}

type Step = 'capture' | 'loading' | 'review' | 'pick_invoice';

export default function ReceiptScanModal({
  isOpen,
  onClose,
  invoiceId,
  onItemsConfirmed,
}: ReceiptScanModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('capture');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [storedReceiptUrl, setStoredReceiptUrl] = useState<string | null>(null);
  const [scanned, setScanned] = useState<ScannedResult | null>(null);
  const [draftItems, setDraftItems] = useState<LineItemDraft[]>([]);
  const [draftInvoices, setDraftInvoices] = useState<DraftInvoice[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('capture');
      setImageFile(null);
      setImagePreviewUrl(null);
      setStoredReceiptUrl(null);
      setScanned(null);
      setDraftItems([]);
      setError(null);
    }
  }, [isOpen]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      setError(null);
      setStep('loading');

      try {
        // 1. Convert to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            // Strip the data-URI prefix (e.g. "data:image/jpeg;base64,")
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // 2. Upload image to Supabase Storage for audit trail
        let receiptUrl: string | null = null;
        const auth = api.loadAuth();
        if (isSupabaseConfigured() && auth?.tenant_id) {
          const ext = file.name.split('.').pop() || 'jpg';
          const path = `${auth.tenant_id}/receipts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from('receipts')
            .upload(path, file, { contentType: file.type, upsert: false });

          if (!uploadError) {
            const { data: signedData } = await supabase.storage
              .from('receipts')
              .createSignedUrl(path, 3600 * 24 * 365); // 1-year signed URL
            receiptUrl = signedData?.signedUrl || null;
          }
        }
        setStoredReceiptUrl(receiptUrl);

        // 3. Call AI scan endpoint
        const mimeType = (file.type || 'image/jpeg') as
          | 'image/jpeg'
          | 'image/png'
          | 'image/webp'
          | 'image/gif';

        const result = await api.request<ScannedResult>('/api/receipts/scan', {
          method: 'POST',
          body: JSON.stringify({ imageBase64: base64, mimeType }),
        });

        setScanned(result);

        // 4. Map scanned items to draft line items
        const items: LineItemDraft[] = (result.items || []).map((i) => ({
          item_type: 'other',
          description: i.description,
          quantity: i.quantity || 1,
          unit: 'unit',
          unit_price_ex_vat: i.unit_price_ex_vat,
          vat_rate: i.vat_rate ?? 20,
          receipt_url: receiptUrl || undefined,
        }));

        // Fallback: if no items returned but we have a total, create one item
        if (items.length === 0 && result.total_inc_vat) {
          const exVat = result.subtotal_ex_vat ?? result.total_inc_vat / 1.2;
          items.push({
            item_type: 'other',
            description: result.supplier_name || 'Receipt purchase',
            quantity: 1,
            unit: 'unit',
            unit_price_ex_vat: Math.round(exVat * 100) / 100,
            vat_rate: 20,
            receipt_url: receiptUrl || undefined,
          });
        }

        setDraftItems(items);
        setStep('review');
      } catch (err: any) {
        setError(err.message || 'Failed to scan receipt. Please try again.');
        setStep('capture');
      }
    },
    []
  );

  const updateDraftItem = (
    idx: number,
    field: keyof LineItemDraft,
    value: string | number
  ) => {
    setDraftItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  const removeDraftItem = (idx: number) => {
    setDraftItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleConfirm = async () => {
    if (invoiceId) {
      // Pre-selected invoice — return items to parent
      onItemsConfirmed(draftItems);
      onClose();
      return;
    }

    // Dashboard flow — need to pick an invoice
    try {
      const data = await api.request<any>('/api/invoices');
      const invoices: DraftInvoice[] = (data.data || data || []).filter(
        (inv: any) => inv.status === 'draft'
      );
      setDraftInvoices(invoices);
      setSelectedInvoiceId(invoices[0]?.id || '');
      setStep('pick_invoice');
    } catch (err: any) {
      setError('Could not load invoices: ' + err.message);
    }
  };

  const handleSaveToInvoice = async () => {
    if (!selectedInvoiceId) return;
    setSaving(true);
    setError(null);

    try {
      // Fetch existing invoice items to merge
      const existing = await api.request<any>(`/api/invoices/${selectedInvoiceId}`);
      const existingItems = (existing.items || []).map((i: any) => ({
        item_type: i.item_type,
        description: i.description,
        quantity: parseFloat(i.quantity),
        unit: i.unit || 'unit',
        unit_price_ex_vat: parseFloat(i.unit_price_ex_vat),
        vat_rate: parseFloat(i.vat_rate),
        receipt_url: i.receipt_url || undefined,
      }));

      await api.request(`/api/invoices/${selectedInvoiceId}/update`, {
        method: 'POST',
        body: JSON.stringify({ items: [...existingItems, ...draftItems] }),
      });

      onItemsConfirmed(draftItems);
      onClose();
    } catch (err: any) {
      setError('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <span>📷</span> Scan Receipt
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* STEP: capture */}
          {step === 'capture' && (
            <div className="text-center space-y-4">
              <p className="text-sm text-gray-600">
                Take a photo of a receipt or upload an image. The AI will extract the amounts and items automatically.
              </p>
              <label className="cursor-pointer inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm transition-colors">
                <span>📷</span> Choose Image / Take Photo
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={handleFileChange}
                />
              </label>
              <p className="text-xs text-gray-400">
                Supports JPEG, PNG, WebP · Max 5 MB
              </p>
            </div>
          )}

          {/* STEP: loading */}
          {step === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-8">
              {imagePreviewUrl && (
                <img
                  src={imagePreviewUrl}
                  alt="Receipt preview"
                  className="max-h-40 rounded-lg object-contain border border-gray-200"
                />
              )}
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
              <p className="text-sm text-gray-600">Uploading and scanning receipt…</p>
            </div>
          )}

          {/* STEP: review */}
          {step === 'review' && scanned && (
            <div className="space-y-4">
              {/* Thumbnail + supplier */}
              <div className="flex items-start gap-3">
                {imagePreviewUrl && (
                  <img
                    src={imagePreviewUrl}
                    alt="Receipt"
                    className="w-16 h-16 rounded-lg object-cover border border-gray-200 shrink-0"
                  />
                )}
                <div>
                  {scanned.supplier_name && (
                    <p className="font-semibold text-gray-900">{scanned.supplier_name}</p>
                  )}
                  {scanned.date && (
                    <p className="text-sm text-gray-500">{scanned.date}</p>
                  )}
                  {scanned.total_inc_vat != null && (
                    <p className="text-sm text-gray-500">
                      Total: <span className="font-medium text-gray-900">£{scanned.total_inc_vat.toFixed(2)}</span>
                    </p>
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-600 font-medium">Review and edit the extracted items:</p>

              {/* Editable item rows */}
              <div className="space-y-3">
                {draftItems.map((item, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Description</label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateDraftItem(idx, 'description', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      {draftItems.length > 1 && (
                        <button
                          onClick={() => removeDraftItem(idx)}
                          className="mt-5 text-gray-400 hover:text-red-500 text-lg leading-none"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Qty</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => updateDraftItem(idx, 'quantity', parseFloat(e.target.value) || 1)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Price ex VAT (£)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price_ex_vat}
                          onChange={(e) => updateDraftItem(idx, 'unit_price_ex_vat', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">VAT %</label>
                        <select
                          value={item.vat_rate}
                          onChange={(e) => updateDraftItem(idx, 'vat_rate', parseFloat(e.target.value))}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <option value={20}>20%</option>
                          <option value={5}>5%</option>
                          <option value={0}>0%</option>
                        </select>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 text-right">
                      Total inc VAT: £{(item.quantity * item.unit_price_ex_vat * (1 + item.vat_rate / 100)).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setStep('capture');
                    setScanned(null);
                    setDraftItems([]);
                  }}
                  className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Rescan
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={draftItems.length === 0}
                  className="flex-1 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {invoiceId ? 'Add to Invoice' : 'Continue →'}
                </button>
              </div>
            </div>
          )}

          {/* STEP: pick_invoice */}
          {step === 'pick_invoice' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Choose which draft invoice to add these {draftItems.length} item{draftItems.length !== 1 ? 's' : ''} to:
              </p>

              {draftInvoices.length === 0 ? (
                <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 text-center">
                  No draft invoices found.{' '}
                  <a href="/invoices/new" className="text-primary-600 hover:underline">
                    Create one first.
                  </a>
                </div>
              ) : (
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => setSelectedInvoiceId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {draftInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number}
                    </option>
                  ))}
                </select>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setStep('review')}
                  className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  ← Back
                </button>
                <button
                  onClick={handleSaveToInvoice}
                  disabled={!selectedInvoiceId || saving}
                  className="flex-1 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {saving ? 'Saving…' : 'Save to Invoice'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
