'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface Client {
  id: string;
  name: string;
  company?: string;
}

interface Site {
  id: string;
  name: string;
  address_line1: string;
  city: string;
  postcode: string;
}

interface QuoteItem {
  id?: string; // undefined for new items, set for existing
  item_type: 'material' | 'labor' | 'other';
  description: string;
  quantity: number;
  unit: string;

  // For materials
  unit_price_ex_vat?: number;
  markup_percent?: number;

  // For labor
  estimated_hours?: number;
  labor_rate?: number;

  vat_rate: number;
  notes?: string;

  // Calculated
  line_total_ex_vat: number;
  line_vat: number;
  line_total_inc_vat: number;

  // Internal tracking
  _deleted?: boolean;
}

export default function EditQuotePage() {
  const router = useRouter();
  const params = useParams();
  const quoteId = params.id as string;

  const [clients, setClients] = useState<Client[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Quote details
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [terms, setTerms] = useState('Payment due within 30 days of acceptance');
  const [notes, setNotes] = useState('');

  // New site modal
  const [showNewSiteModal, setShowNewSiteModal] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteAddress1, setNewSiteAddress1] = useState('');
  const [newSiteAddress2, setNewSiteAddress2] = useState('');
  const [newSiteCity, setNewSiteCity] = useState('');
  const [newSiteCounty, setNewSiteCounty] = useState('');
  const [newSitePostcode, setNewSitePostcode] = useState('');
  const [newSiteAccessNotes, setNewSiteAccessNotes] = useState('');
  const [creatingSite, setCreatingSite] = useState(false);

  // Quote items — tracks existing (with id) and new (no id), plus deleted ids
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [deletedItemIds, setDeletedItemIds] = useState<string[]>([]);
  const [showAddItem, setShowAddItem] = useState(false);

  // New item form
  const [newItemType, setNewItemType] = useState<'material' | 'labor' | 'other'>('labor');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('1');
  const [newItemUnit, setNewItemUnit] = useState('unit');
  const [newItemUnitPrice, setNewItemUnitPrice] = useState('');
  const [newItemMarkup, setNewItemMarkup] = useState('25');
  const [newItemHours, setNewItemHours] = useState('');
  const [newItemRate, setNewItemRate] = useState('45');
  const [newItemVatRate, setNewItemVatRate] = useState('20');
  const [newItemNotes, setNewItemNotes] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      loadSites(selectedClientId);
    } else {
      setSites([]);
      setSelectedSiteId('');
    }
  }, [selectedClientId]);

  const loadData = async () => {
    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      // Load clients and quote in parallel
      const [clientsData, quoteData] = await Promise.all([
        api.request('/api/clients/clients') as Promise<Client[]>,
        api.request(`/api/quotes/${quoteId}`) as Promise<any>,
      ]);

      setClients(clientsData);

      // Pre-populate quote header fields
      setTitle(quoteData.title || '');
      setDescription(quoteData.description || '');
      setNotes(quoteData.notes || '');
      setTerms(quoteData.terms || 'Payment due within 30 days of acceptance');

      if (quoteData.valid_until) {
        // Normalize to YYYY-MM-DD for the date input
        setValidUntil(quoteData.valid_until.split('T')[0]);
      }

      // Set client; sites will load via the useEffect
      if (quoteData.client_id) {
        setSelectedClientId(quoteData.client_id);

        // Load sites for the client, then set the site
        const sitesData = await api.request(
          `/api/clients/clients/${quoteData.client_id}/sites`
        ) as Site[];
        setSites(sitesData);
        if (quoteData.site_id) {
          setSelectedSiteId(quoteData.site_id);
        } else if (sitesData.length > 0) {
          setSelectedSiteId(sitesData[0].id);
        }
      }

      // Pre-populate items
      if (quoteData.items && Array.isArray(quoteData.items)) {
        const loadedItems: QuoteItem[] = quoteData.items.map((item: any) => ({
          id: item.id,
          item_type: item.item_type,
          description: item.description,
          quantity: Number(item.quantity),
          unit: item.unit || 'unit',
          unit_price_ex_vat: item.unit_price_ex_vat != null ? Number(item.unit_price_ex_vat) : undefined,
          markup_percent: item.markup_percent != null ? Number(item.markup_percent) : undefined,
          estimated_hours: item.estimated_hours != null ? Number(item.estimated_hours) : undefined,
          labor_rate: item.labor_rate != null ? Number(item.labor_rate) : undefined,
          vat_rate: Number(item.vat_rate ?? 20),
          notes: item.notes || undefined,
          line_total_ex_vat: Number(item.line_total_ex_vat ?? 0),
          line_vat: Number(item.line_vat ?? 0),
          line_total_inc_vat: Number(item.line_total_inc_vat ?? 0),
        }));
        setItems(loadedItems);
      }

      // Load tenant profile for default VAT rate on new items
      try {
        const profile = await api.request('/api/identity/profile') as any;
        const profileData = profile.data || profile;
        if (profileData.default_vat_rate != null) {
          setNewItemVatRate(String(profileData.default_vat_rate));
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      }
    } catch (err) {
      console.error('Failed to load quote data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSites = async (clientId: string) => {
    try {
      const sitesData = await api.request(`/api/clients/clients/${clientId}/sites`) as Site[];
      setSites(sitesData);
      if (sitesData.length > 0 && !selectedSiteId) {
        setSelectedSiteId(sitesData[0].id);
      }
    } catch (err) {
      console.error('Failed to load sites:', err);
    }
  };

  const createNewSite = async () => {
    if (!selectedClientId || !newSiteName || !newSiteAddress1 || !newSiteCity || !newSitePostcode) {
      alert('Please fill in all required site fields');
      return;
    }

    setCreatingSite(true);
    try {
      const siteData = {
        client_id: selectedClientId,
        name: newSiteName,
        address_line1: newSiteAddress1,
        address_line2: newSiteAddress2 || undefined,
        city: newSiteCity,
        county: newSiteCounty || undefined,
        postcode: newSitePostcode,
        access_notes: newSiteAccessNotes || undefined,
      };

      const result = await api.request('/api/clients/sites', {
        method: 'POST',
        body: JSON.stringify(siteData),
      });

      await loadSites(selectedClientId);
      setSelectedSiteId(result.id);

      setShowNewSiteModal(false);
      setNewSiteName('');
      setNewSiteAddress1('');
      setNewSiteAddress2('');
      setNewSiteCity('');
      setNewSiteCounty('');
      setNewSitePostcode('');
      setNewSiteAccessNotes('');
    } catch (err) {
      console.error('Failed to create site:', err);
      alert('Failed to create site. Please try again.');
    } finally {
      setCreatingSite(false);
    }
  };

  const calculateItemTotals = (item: Partial<QuoteItem>) => {
    let unitPrice = 0;
    const quantity = Number(item.quantity) || 0;
    const vatRate = Number(item.vat_rate) || 20;

    if (item.item_type === 'labor') {
      const hours = Number(item.estimated_hours) || 0;
      const rate = Number(item.labor_rate) || 0;
      unitPrice = hours * rate;
    } else {
      unitPrice = Number(item.unit_price_ex_vat) || 0;
    }

    const markup = Number(item.markup_percent) || 0;
    const lineTotalExVat = Math.round(quantity * unitPrice * (1 + markup / 100) * 100) / 100;
    const lineVat = Math.round(lineTotalExVat * (vatRate / 100) * 100) / 100;
    const lineTotalIncVat = lineTotalExVat + lineVat;

    return {
      line_total_ex_vat: lineTotalExVat,
      line_vat: lineVat,
      line_total_inc_vat: lineTotalIncVat,
    };
  };

  const addItem = () => {
    const newItem: QuoteItem = {
      // no `id` — signals this is a newly added item
      item_type: newItemType,
      description: newItemDescription,
      quantity: Number(newItemQuantity),
      unit: newItemType === 'labor' ? 'hour' : newItemUnit,
      unit_price_ex_vat: newItemType !== 'labor' ? Number(newItemUnitPrice) : undefined,
      markup_percent: newItemType === 'material' ? Number(newItemMarkup) : 0,
      estimated_hours: newItemType === 'labor' ? Number(newItemHours) : undefined,
      labor_rate: newItemType === 'labor' ? Number(newItemRate) : undefined,
      vat_rate: Number(newItemVatRate),
      notes: newItemNotes || undefined,
      line_total_ex_vat: 0,
      line_vat: 0,
      line_total_inc_vat: 0,
    };

    const totals = calculateItemTotals(newItem);
    newItem.line_total_ex_vat = totals.line_total_ex_vat;
    newItem.line_vat = totals.line_vat;
    newItem.line_total_inc_vat = totals.line_total_inc_vat;

    setItems([...items, newItem]);

    // Reset form
    setNewItemDescription('');
    setNewItemQuantity('1');
    setNewItemUnitPrice('');
    setNewItemHours('');
    setNewItemNotes('');
    setShowAddItem(false);
  };

  const removeItem = (index: number) => {
    const item = items[index];
    // If it has a DB id, track it for deletion
    if (item.id) {
      setDeletedItemIds(prev => [...prev, item.id!]);
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.line_total_ex_vat, 0);
    const vatAmount = items.reduce((sum, item) => sum + item.line_vat, 0);
    const total = items.reduce((sum, item) => sum + item.line_total_inc_vat, 0);
    return { subtotal, vatAmount, total };
  };

  const saveChanges = async () => {
    if (!selectedClientId || !selectedSiteId || !title) {
      alert('Please fill in all required fields (client, site, and title)');
      return;
    }

    setSaving(true);
    try {
      // 1. Update quote header
      await api.request(`/api/quotes/${quoteId}`, {
        method: 'PUT',
        body: JSON.stringify({
          title,
          description,
          valid_until: validUntil,
          terms,
          notes,
        }),
      });

      // 2. Delete removed items
      await Promise.all(
        deletedItemIds.map(itemId =>
          api.request(`/api/quotes/${quoteId}/items/${itemId}`, {
            method: 'DELETE',
          })
        )
      );

      // 3. Add newly created items (those without an id)
      const newItems = items.filter(item => !item.id);
      await Promise.all(
        newItems.map(item => {
          const unitPrice =
            item.item_type === 'labor'
              ? (item.estimated_hours || 0) * (item.labor_rate || 0)
              : item.unit_price_ex_vat || 0;

          return api.request(`/api/quotes/${quoteId}/items`, {
            method: 'POST',
            body: JSON.stringify({
              item_type: item.item_type,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              unit_price_ex_vat: unitPrice,
              markup_percent: item.markup_percent || 0,
              estimated_hours: item.estimated_hours,
              labor_rate: item.labor_rate,
              vat_rate: item.vat_rate,
              notes: item.notes,
            }),
          });
        })
      );

      router.push(`/quotes/${quoteId}`);
    } catch (err) {
      console.error('Failed to save changes:', err);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const totals = calculateTotals();

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Edit Quote</h1>
            <p className="mt-2 text-gray-600">Update quote details, terms, and line items</p>
          </div>
          <button
            onClick={() => router.push(`/quotes/${quoteId}`)}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Client & Site Selection */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Client & Location</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  >
                    <option value="">Select a client...</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name} {client.company && `(${client.company})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Site <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedSiteId}
                    onChange={(e) => setSelectedSiteId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                    disabled={!selectedClientId}
                  >
                    <option value="">Select a site...</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name} - {site.postcode}
                      </option>
                    ))}
                  </select>
                  {selectedClientId && (
                    <button
                      type="button"
                      onClick={() => setShowNewSiteModal(true)}
                      className="mt-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      + Create New Site
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quote Details */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quote Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Kitchen Rewire & Consumer Unit Replacement"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief overview of the work to be carried out..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Valid Until
                    </label>
                    <input
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Terms & Conditions
                  </label>
                  <textarea
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Internal Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Internal notes (not visible to client)..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>

            {/* Quote Items */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Quote Items
                </h2>
                <button
                  onClick={() => setShowAddItem(!showAddItem)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
                >
                  + Add Item
                </button>
              </div>

              {/* Add Item Form */}
              {showAddItem && (
                <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <h3 className="font-medium text-gray-900 mb-3">New Item</h3>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Item Type</label>
                      <select
                        value={newItemType}
                        onChange={(e) => setNewItemType(e.target.value as any)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                      >
                        <option value="labor">Labor</option>
                        <option value="material">Material</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <input
                        type="text"
                        value={newItemDescription}
                        onChange={(e) => setNewItemDescription(e.target.value)}
                        placeholder={newItemType === 'labor' ? 'e.g., Install consumer unit and test' : 'e.g., 18-way consumer unit'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>

                    {newItemType === 'labor' ? (
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Hours</label>
                          <input
                            type="number"
                            step="0.5"
                            value={newItemHours}
                            onChange={(e) => setNewItemHours(e.target.value)}
                            placeholder="4.5"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Rate (£/hr)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={newItemRate}
                            onChange={(e) => setNewItemRate(e.target.value)}
                            placeholder="45.00"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">VAT %</label>
                          <input
                            type="number"
                            step="0.01"
                            value={newItemVatRate}
                            onChange={(e) => setNewItemVatRate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Qty</label>
                          <input
                            type="number"
                            step="0.01"
                            value={newItemQuantity}
                            onChange={(e) => setNewItemQuantity(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price (£)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={newItemUnitPrice}
                            onChange={(e) => setNewItemUnitPrice(e.target.value)}
                            placeholder="150.00"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Markup %</label>
                          <input
                            type="number"
                            step="0.01"
                            value={newItemMarkup}
                            onChange={(e) => setNewItemMarkup(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">VAT %</label>
                          <input
                            type="number"
                            step="0.01"
                            value={newItemVatRate}
                            onChange={(e) => setNewItemVatRate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                      <input
                        type="text"
                        value={newItemNotes}
                        onChange={(e) => setNewItemNotes(e.target.value)}
                        placeholder="Additional details..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={addItem}
                        disabled={!newItemDescription || (newItemType === 'labor' ? !newItemHours || !newItemRate : !newItemUnitPrice)}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        Add Item
                      </button>
                      <button
                        onClick={() => setShowAddItem(false)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Items List */}
              {items.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No items. Click "Add Item" to add line items to this quote.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={item.id ?? `new-${index}`} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700">
                              {item.item_type}
                            </span>
                            {!item.id && (
                              <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700">
                                new
                              </span>
                            )}
                            <span className="font-medium text-gray-900">{item.description}</span>
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            {item.item_type === 'labor' ? (
                              <p>
                                {item.estimated_hours} hours × £{item.labor_rate}/hr = £{((item.estimated_hours ?? 0) * (item.labor_rate ?? 0)).toFixed(2)}
                              </p>
                            ) : (
                              <p>
                                {item.quantity} × £{item.unit_price_ex_vat?.toFixed(2)}
                                {item.markup_percent ? ` + ${item.markup_percent}% markup` : ''}
                              </p>
                            )}
                            {item.notes && <p className="text-gray-500 italic">{item.notes}</p>}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="font-semibold text-gray-900">
                            {formatCurrency(item.line_total_inc_vat)}
                          </div>
                          <div className="text-xs text-gray-500">inc VAT</div>
                          <button
                            onClick={() => removeItem(index)}
                            className="mt-2 text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow rounded-lg p-6 sticky top-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quote Summary</h2>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Items</span>
                  <span className="font-medium">{items.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal (ex VAT)</span>
                  <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">VAT</span>
                  <span className="font-medium">{formatCurrency(totals.vatAmount)}</span>
                </div>
                <div className="pt-3 border-t border-gray-200">
                  <div className="flex justify-between">
                    <span className="text-base font-semibold text-gray-900">Total (inc VAT)</span>
                    <span className="text-xl font-bold text-gray-900">{formatCurrency(totals.total)}</span>
                  </div>
                </div>
              </div>

              {deletedItemIds.length > 0 && (
                <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md">
                  <p className="text-xs text-amber-800">
                    {deletedItemIds.length} item{deletedItemIds.length !== 1 ? 's' : ''} will be permanently deleted on save.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={saveChanges}
                  disabled={saving || !selectedClientId || !title}
                  className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => router.push(`/quotes/${quoteId}`)}
                  disabled={saving}
                  className="w-full px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New Site Modal */}
      {showNewSiteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Create New Site</h2>
              <button
                onClick={() => setShowNewSiteModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Site Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  placeholder="e.g., Main Office, Home Address"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address Line 1 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newSiteAddress1}
                  onChange={(e) => setNewSiteAddress1(e.target.value)}
                  placeholder="Street address"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address Line 2
                </label>
                <input
                  type="text"
                  value={newSiteAddress2}
                  onChange={(e) => setNewSiteAddress2(e.target.value)}
                  placeholder="Suite, unit, building, floor, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newSiteCity}
                    onChange={(e) => setNewSiteCity(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    County
                  </label>
                  <input
                    type="text"
                    value={newSiteCounty}
                    onChange={(e) => setNewSiteCounty(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Postcode <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newSitePostcode}
                  onChange={(e) => setNewSitePostcode(e.target.value)}
                  placeholder="e.g., SW1A 1AA"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Access Notes
                </label>
                <textarea
                  value={newSiteAccessNotes}
                  onChange={(e) => setNewSiteAccessNotes(e.target.value)}
                  placeholder="Parking information, access codes, etc."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={createNewSite}
                  disabled={creatingSite || !newSiteName || !newSiteAddress1 || !newSiteCity || !newSitePostcode}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {creatingSite ? 'Creating...' : 'Create Site'}
                </button>
                <button
                  onClick={() => setShowNewSiteModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
