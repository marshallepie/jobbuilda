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

interface Client {
  id: string;
  name: string;
  email?: string;
  company?: string;
}

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

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quoteId = searchParams?.get('quote_id');
  const jobId = searchParams?.get('job_id');

  // Quote-based flow
  const [quote, setQuote] = useState<Quote | null>(null);
  const [depositPercent, setDepositPercent] = useState(30);

  // Job-based flow
  const [jobTitle, setJobTitle] = useState('');
  const [jobNumber, setJobNumber] = useState('');

  // Standalone flow
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('new');
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientCompany, setNewClientCompany] = useState('');
  const [invoiceType, setInvoiceType] = useState<'final' | 'deposit' | 'progress' | 'credit_note'>('final');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentTermsDays, setPaymentTermsDays] = useState(30);
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([blankItem()]);

  const [defaultVatRate, setDefaultVatRate] = useState(20);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const mockAuth = {
      token: 'mock-jwt-token',
      tenant_id: '550e8400-e29b-41d4-a716-446655440000',
      user_id: '550e8400-e29b-41d4-a716-446655440001',
    };
    api.setAuth(mockAuth);

    if (quoteId) {
      loadQuote();
    } else if (jobId) {
      loadJob();
    } else {
      loadClients();
    }
  }, [quoteId, jobId]);

  const loadQuote = async () => {
    try {
      const data = await api.request(`/api/quotes/${quoteId}`) as any;
      setQuote(data);
    } catch (err) {
      console.error('Failed to load quote:', err);
      setError('Failed to load quote. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      const [clientsData, profileData] = await Promise.all([
        api.getClients() as any,
        api.request('/api/identity/profile').catch(() => null) as any,
      ]);
      setClients(Array.isArray(clientsData) ? clientsData : (clientsData.data || []));
      const profile = profileData?.data || profileData;
      if (profile?.default_vat_rate != null) {
        const rate = Number(profile.default_vat_rate);
        setDefaultVatRate(rate);
        setLineItems([blankItem(rate)]);
      }
    } catch (err) {
      console.error('Failed to load clients:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadJob = async () => {
    try {
      const [jobData, profileData, clientsData] = await Promise.all([
        api.request(`/api/jobs/${jobId}`) as any,
        api.request('/api/identity/profile').catch(() => null) as any,
        api.getClients().catch(() => []) as any,
      ]);

      setClients(Array.isArray(clientsData) ? clientsData : (clientsData?.data || []));

      const profile = profileData?.data || profileData;
      const vatRate = profile?.default_vat_rate != null ? Number(profile.default_vat_rate) : 20;
      setDefaultVatRate(vatRate);

      setJobTitle(jobData.title || '');
      setJobNumber(jobData.job_number || '');

      if (jobData.client_id) {
        setClientMode('existing');
        setSelectedClientId(jobData.client_id);
      }

      setInvoiceType('final');

      // Load materials and variations separately — time entries are already on jobData
      const [materialsResp, variationsResp] = await Promise.all([
        api.getJobMaterials(jobId!).catch(() => null) as any,
        api.getJobVariations(jobId!).catch(() => null) as any,
      ]);

      const items: LineItem[] = [];

      // Time entries — included in job GET response as time_entries[]
      const timeArr: any[] = Array.isArray(jobData.time_entries) ? jobData.time_entries : [];
      for (const entry of timeArr) {
        const hours = parseFloat(entry.hours) || 0;
        if (hours <= 0) continue;
        items.push({
          item_type: 'labor',
          description: entry.notes || entry.description || 'Labour',
          quantity: String(hours),
          unit: 'hrs',
          unit_price_ex_vat: '0',
          vat_rate: String(vatRate),
        });
      }

      // Materials — response shape: { materials: [...], summary: {...} }
      const matArr: any[] = materialsResp?.materials || [];
      for (const mat of matArr) {
        const qty = parseFloat(mat.quantity_used ?? mat.quantity) || 0;
        if (qty <= 0) continue;
        items.push({
          item_type: 'material',
          description: mat.name || mat.description || 'Material',
          quantity: String(qty),
          unit: mat.unit || 'unit',
          unit_price_ex_vat: String(parseFloat(mat.unit_cost ?? mat.unit_price_ex_vat) || 0),
          vat_rate: String(vatRate),
        });
      }

      // Variations — response shape: { variations: [...], summary: {...} }
      // Include approved and completed variations; field is total_ex_vat
      const varArr: any[] = variationsResp?.variations || [];
      for (const variation of varArr) {
        if (variation.status !== 'approved' && variation.status !== 'completed') continue;
        items.push({
          item_type: 'variation',
          description: variation.title || variation.description || 'Variation',
          quantity: '1',
          unit: 'job',
          unit_price_ex_vat: String(parseFloat(variation.total_ex_vat) || 0),
          vat_rate: String(vatRate),
        });
      }

      setLineItems(items.length > 0 ? items : [blankItem(vatRate)]);
    } catch (err) {
      console.error('Failed to load job:', err);
      setError('Failed to load job details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Quote-based: deposit invoice creation ───────────────────────────────

  const createDepositInvoice = async () => {
    if (!quote) return;
    if (!confirm(`Create ${depositPercent}% deposit invoice for quote ${quote.quote_number}?`)) return;

    setCreating(true);
    setError('');
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

      // Step 2: Scale items to deposit percentage
      const depositMultiplier = depositPercent / 100;
      const depositItems = quote.items?.map(item => ({
        item_type: item.item_type,
        description: `${item.description} (${depositPercent}% deposit)`,
        quantity: parseFloat(item.quantity) * depositMultiplier,
        unit: item.unit,
        unit_price_ex_vat: parseFloat(item.unit_price_ex_vat),
        vat_rate: parseFloat(item.vat_rate) || 0,
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

      router.push(`/invoices/${invoice.id}`);
    } catch (err: any) {
      console.error('Failed to create invoice:', err);
      setError(err.message || 'Failed to create deposit invoice. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  // ─── Standalone invoice creation ─────────────────────────────────────────

  const addItem = () => setLineItems(prev => [...prev, blankItem(defaultVatRate)]);

  const removeItem = (idx: number) =>
    setLineItems(prev => prev.filter((_, i) => i !== idx));

  const updateItem = (idx: number, field: keyof LineItem, value: string) =>
    setLineItems(prev =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );

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

  const createStandaloneInvoice = async () => {
    setError('');

    // Validate
    if (clientMode === 'existing' && !selectedClientId) {
      setError('Please select a client.');
      return;
    }
    if (clientMode === 'new' && !newClientName.trim()) {
      setError('Client name is required.');
      return;
    }
    if (lineItems.some(item => !item.description.trim())) {
      setError('All line items must have a description.');
      return;
    }
    if (lineItems.some(item => parseFloat(item.quantity) <= 0)) {
      setError('All line item quantities must be greater than 0.');
      return;
    }

    setCreating(true);
    try {
      let clientId = selectedClientId;

      // Create client if needed
      if (clientMode === 'new') {
        const newClient = await api.request('/api/clients/clients', {
          method: 'POST',
          body: JSON.stringify({
            name: newClientName.trim(),
            email: newClientEmail.trim() || undefined,
            phone: newClientPhone.trim() || undefined,
            company: newClientCompany.trim() || undefined,
          }),
        }) as any;
        clientId = newClient.id || newClient.client_id;
      }

      const items = lineItems.map(item => ({
        item_type: item.item_type,
        description: item.description.trim(),
        quantity: parseFloat(item.quantity),
        unit: item.unit.trim() || 'unit',
        unit_price_ex_vat: parseFloat(item.unit_price_ex_vat),
        vat_rate: parseFloat(item.vat_rate) || 0,
      }));

      const invoice = await api.request('/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          client_id: clientId,
          job_id: jobId || undefined,
          invoice_type: invoiceType,
          invoice_date: invoiceDate,
          payment_terms_days: paymentTermsDays,
          items,
          notes: notes.trim() || undefined,
        }),
      }) as any;

      router.push(`/invoices/${invoice.id}`);
    } catch (err: any) {
      console.error('Failed to create invoice:', err);
      setError(err.message || 'Failed to create invoice. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  // ─── Loading state ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </AppLayout>
    );
  }

  // ─── Quote-based flow ─────────────────────────────────────────────────────

  if (quoteId) {
    if (!quote) {
      return (
        <AppLayout>
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Quote Not Found</h2>
            <p className="text-gray-600 mb-6">Could not load quote details.</p>
            <Link href="/quotes" className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
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

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">{error}</div>
          )}

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
                <span className="text-xl font-bold text-gray-900">{formatCurrency(quote.total_inc_vat)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Deposit Configuration</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Deposit Percentage</label>
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
                  <span>10%</span><span>50%</span><span>100%</span>
                </div>
              </div>
              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-600">Deposit Invoice Amount</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {depositPercent}% of the total quote value
                    </p>
                  </div>
                  <div className="text-3xl font-bold text-green-600">{formatCurrency(depositAmount)}</div>
                </div>
              </div>
            </div>
          </div>

          {quote.items && quote.items.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice Items Preview</h2>
              <p className="text-sm text-gray-600 mb-3">
                Items at {depositPercent}% of quoted quantities:
              </p>
              <div className="space-y-2">
                {quote.items.map((item, idx) => (
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
          )}

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
        </div>
      </AppLayout>
    );
  }

  // ─── Standalone invoice creation form ────────────────────────────────────

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {jobId ? 'Create Invoice' : 'New Invoice'}
            </h1>
            <p className="text-gray-600 mt-1">
              {jobId ? `From job ${jobNumber || jobId}${jobTitle ? ` – ${jobTitle}` : ''}` : 'Create a standalone invoice'}
            </p>
          </div>
          <Link
            href={jobId ? `/jobs/${jobId}` : '/invoices'}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {jobId ? 'Back to Job' : 'Cancel'}
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">{error}</div>
        )}

        {/* Client Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Client</h2>

          <div className="flex gap-4 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="clientMode"
                value="new"
                checked={clientMode === 'new'}
                onChange={() => setClientMode('new')}
                className="text-primary-600"
              />
              <span className="text-sm font-medium text-gray-700">New client</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="clientMode"
                value="existing"
                checked={clientMode === 'existing'}
                onChange={() => setClientMode('existing')}
                className="text-primary-600"
              />
              <span className="text-sm font-medium text-gray-700">Existing client</span>
            </label>
          </div>

          {clientMode === 'existing' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Client</label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">-- Choose a client --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.company ? ` (${c.company})` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Full name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <input
                  type="text"
                  value={newClientCompany}
                  onChange={(e) => setNewClientCompany(e.target.value)}
                  placeholder="Company name (optional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  placeholder="Phone number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Invoice Details */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={invoiceType}
                onChange={(e) => setInvoiceType(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="final">Final</option>
                <option value="deposit">Deposit</option>
                <option value="progress">Progress</option>
                <option value="credit_note">Credit Note</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms (days)</label>
              <input
                type="number"
                min="0"
                value={paymentTermsDays}
                onChange={(e) => setPaymentTermsDays(parseInt(e.target.value) || 30)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Line Items</h2>
            <button
              type="button"
              onClick={addItem}
              className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              + Add Item
            </button>
          </div>

          <div className="space-y-3">
            {lineItems.map((item, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-4">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  {/* Description */}
                  <div className="sm:col-span-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(idx, 'description', e.target.value)}
                      placeholder="Item description"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  {/* Type */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                    <select
                      value={item.item_type}
                      onChange={(e) => updateItem(idx, 'item_type', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="labor">Labor</option>
                      <option value="material">Material</option>
                      <option value="variation">Variation</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  {/* Qty */}
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Qty</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  {/* Unit */}
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Unit</label>
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                      placeholder="unit"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  {/* Unit Price */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Unit Price (ex VAT)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price_ex_vat}
                      onChange={(e) => updateItem(idx, 'unit_price_ex_vat', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  {/* VAT */}
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">VAT %</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.vat_rate}
                      onChange={(e) => updateItem(idx, 'vat_rate', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  {/* Total + remove */}
                  <div className="sm:col-span-1 flex flex-col justify-between">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Total</label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                        {formatCurrency(calcItemTotal(item))}
                      </span>
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-red-500 hover:text-red-700 text-lg leading-none"
                          title="Remove item"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mt-4 pt-4 border-t border-gray-200 flex flex-col items-end gap-1 text-sm">
            <div className="flex gap-8 text-gray-600">
              <span>Subtotal (ex VAT)</span>
              <span className="font-medium w-28 text-right">{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex gap-8 text-gray-600">
              <span>VAT</span>
              <span className="font-medium w-28 text-right">{formatCurrency(totals.vat)}</span>
            </div>
            <div className="flex gap-8 text-gray-900 font-semibold text-base">
              <span>Total (inc VAT)</span>
              <span className="w-28 text-right">{formatCurrency(totals.subtotal + totals.vat)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes for this invoice..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pb-6">
          <Link
            href="/invoices"
            className="px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
          >
            Cancel
          </Link>
          <button
            onClick={createStandaloneInvoice}
            disabled={creating}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
          >
            {creating ? 'Creating Invoice...' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
