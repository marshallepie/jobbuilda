'use client';

import { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { api } from '@/lib/api';

interface BusinessProfile {
  id: string;
  name: string;
  trading_name?: string;
  company_number?: string;
  vat_number?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  county?: string;
  postcode?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  invoice_prefix?: string;
  next_invoice_number?: number;
  quote_prefix?: string;
  next_quote_number?: number;
  bank_name?: string;
  account_name?: string;
  sort_code?: string;
  account_number?: string;
  payment_terms?: string;
  default_vat_rate?: number;
  logo_url?: string;
  primary_color?: string;
  invoice_template_id?: string;
  quote_template_id?: string;
  template_font?: string;
  show_payment_qr?: boolean;
  show_item_codes?: boolean;
  show_item_descriptions?: boolean;
  footer_text?: string;
  header_image_url?: string;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('profile');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      const data = await api.request('/api/identity/profile') as BusinessProfile;
      setProfile(data);
    } catch (err) {
      console.error('Failed to load profile:', err);
      alert('Failed to load business profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      await api.request('/api/identity/profile', {
        method: 'PUT',
        body: JSON.stringify(profile),
      });

      alert('Business profile updated successfully!');
    } catch (err: any) {
      console.error('Failed to save profile:', err);
      alert(err.message || 'Failed to save business profile');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof BusinessProfile, value: any) => {
    setProfile(prev => prev ? { ...prev, [field]: value } : null);
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

  if (!profile) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-gray-600">Failed to load business profile</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="mt-2 text-gray-600">Configure your business settings</p>
        </div>

        {/* Settings Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveSection('profile')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeSection === 'profile'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🏢 Business Profile
            </button>
            <button
              onClick={() => setActiveSection('team')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeSection === 'team'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              👥 Team Members
            </button>
            <button
              onClick={() => setActiveSection('templates')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeSection === 'templates'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📋 Templates
            </button>
          </nav>
        </div>

        {/* Business Profile Section */}
        {activeSection === 'profile' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Business Profile</h2>
              <p className="text-sm text-gray-600">Company details that appear on quotes and invoices</p>
            </div>

            <div className="p-6 space-y-8">
              {/* Company Information */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Company Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={profile.name || ''}
                      onChange={(e) => updateField('name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Trading Name
                    </label>
                    <input
                      type="text"
                      value={profile.trading_name || ''}
                      onChange={(e) => updateField('trading_name', e.target.value)}
                      placeholder="If different from company name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company Number
                    </label>
                    <input
                      type="text"
                      value={profile.company_number || ''}
                      onChange={(e) => updateField('company_number', e.target.value)}
                      placeholder="Companies House number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      VAT Number
                    </label>
                    <input
                      type="text"
                      value={profile.vat_number || ''}
                      onChange={(e) => updateField('vat_number', e.target.value)}
                      placeholder="GB123456789"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Business Address</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address Line 1
                    </label>
                    <input
                      type="text"
                      value={profile.address_line1 || ''}
                      onChange={(e) => updateField('address_line1', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address Line 2
                    </label>
                    <input
                      type="text"
                      value={profile.address_line2 || ''}
                      onChange={(e) => updateField('address_line2', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        City
                      </label>
                      <input
                        type="text"
                        value={profile.city || ''}
                        onChange={(e) => updateField('city', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        County
                      </label>
                      <input
                        type="text"
                        value={profile.county || ''}
                        onChange={(e) => updateField('county', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Postcode
                      </label>
                      <input
                        type="text"
                        value={profile.postcode || ''}
                        onChange={(e) => updateField('postcode', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Details */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Contact Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={profile.phone || ''}
                      onChange={(e) => updateField('phone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={profile.email || ''}
                      onChange={(e) => updateField('email', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Website
                    </label>
                    <input
                      type="url"
                      value={profile.website || ''}
                      onChange={(e) => updateField('website', e.target.value)}
                      placeholder="https://"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>

              {/* Invoice & Quote Settings */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Invoice & Quote Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Invoice Prefix
                    </label>
                    <input
                      type="text"
                      value={profile.invoice_prefix || ''}
                      onChange={(e) => updateField('invoice_prefix', e.target.value)}
                      placeholder="INV"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Next Invoice Number
                    </label>
                    <input
                      type="number"
                      value={profile.next_invoice_number || ''}
                      onChange={(e) => updateField('next_invoice_number', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quote Prefix
                    </label>
                    <input
                      type="text"
                      value={profile.quote_prefix || ''}
                      onChange={(e) => updateField('quote_prefix', e.target.value)}
                      placeholder="QUO"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Next Quote Number
                    </label>
                    <input
                      type="number"
                      value={profile.next_quote_number || ''}
                      onChange={(e) => updateField('next_quote_number', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default VAT Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={profile.default_vat_rate ?? ''}
                      onChange={(e) => updateField('default_vat_rate', e.target.value === '' ? null : parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Terms
                  </label>
                  <textarea
                    value={profile.payment_terms || ''}
                    onChange={(e) => updateField('payment_terms', e.target.value)}
                    rows={3}
                    placeholder="Payment due within 30 days of invoice date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* Banking Details */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Banking Details</h3>
                <p className="text-sm text-gray-600 mb-4">For bank transfer payments on invoices</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={profile.bank_name || ''}
                      onChange={(e) => updateField('bank_name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Account Name
                    </label>
                    <input
                      type="text"
                      value={profile.account_name || ''}
                      onChange={(e) => updateField('account_name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sort Code
                    </label>
                    <input
                      type="text"
                      value={profile.sort_code || ''}
                      onChange={(e) => updateField('sort_code', e.target.value)}
                      placeholder="00-00-00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Account Number
                    </label>
                    <input
                      type="text"
                      value={profile.account_number || ''}
                      onChange={(e) => updateField('account_number', e.target.value)}
                      placeholder="12345678"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>

              {/* Branding */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Branding</h3>
                <p className="text-sm text-gray-600 mb-4">Customize the appearance of your documents</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company Logo URL
                    </label>
                    <input
                      type="url"
                      value={profile.logo_url || ''}
                      onChange={(e) => updateField('logo_url', e.target.value)}
                      placeholder="https://example.com/logo.png"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Logo displayed on invoices and quotes (recommended: 400x100px PNG)
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Primary Brand Color
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={profile.primary_color || '#3B82F6'}
                        onChange={(e) => updateField('primary_color', e.target.value)}
                        className="h-10 w-20 border border-gray-300 rounded-md cursor-pointer"
                      />
                      <input
                        type="text"
                        value={profile.primary_color || '#3B82F6'}
                        onChange={(e) => updateField('primary_color', e.target.value)}
                        placeholder="#3B82F6"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Used for headings and accents on documents
                    </p>
                  </div>
                </div>
                {profile.logo_url && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-2">Logo Preview:</p>
                    <img
                      src={profile.logo_url}
                      alt="Company Logo"
                      className="max-h-20 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Save Button */}
              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Placeholder sections */}
        {activeSection === 'team' && (
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              👥 Team Members
            </h3>
            <p className="text-gray-600 text-sm">
              Coming soon: Manage users and permissions
            </p>
          </div>
        )}

        {activeSection === 'templates' && (
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">
              📋 Invoice & Quote Templates
            </h3>

            {/* Template Layout Selection */}
            <div className="mb-8">
              <h4 className="text-md font-medium text-gray-900 mb-4">Template Layouts</h4>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Invoice Template */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Invoice Template
                  </label>
                  <select
                    value={profile?.invoice_template_id || 'modern'}
                    onChange={(e) => updateField('invoice_template_id', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="modern">Modern - Clean and minimal design</option>
                    <option value="classic">Classic - Traditional invoice layout</option>
                    <option value="minimal">Minimal - Ultra-simple design</option>
                    <option value="detailed">Detailed - Comprehensive information</option>
                  </select>
                </div>

                {/* Quote Template */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quote Template
                  </label>
                  <select
                    value={profile?.quote_template_id || 'modern'}
                    onChange={(e) => updateField('quote_template_id', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="modern">Modern - Clean and minimal design</option>
                    <option value="classic">Classic - Traditional quote layout</option>
                    <option value="minimal">Minimal - Ultra-simple design</option>
                    <option value="detailed">Detailed - Comprehensive information</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Typography */}
            <div className="mb-8">
              <h4 className="text-md font-medium text-gray-900 mb-4">Typography</h4>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Font Family
                </label>
                <select
                  value={profile?.template_font || 'Inter'}
                  onChange={(e) => updateField('template_font', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Inter">Inter - Modern sans-serif</option>
                  <option value="Helvetica">Helvetica - Classic sans-serif</option>
                  <option value="Times New Roman">Times New Roman - Traditional serif</option>
                  <option value="Georgia">Georgia - Elegant serif</option>
                  <option value="Arial">Arial - Standard sans-serif</option>
                </select>
              </div>
            </div>

            {/* Display Options */}
            <div className="mb-8">
              <h4 className="text-md font-medium text-gray-900 mb-4">Display Options</h4>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={profile?.show_item_codes || false}
                    onChange={(e) => updateField('show_item_codes', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-3 text-sm text-gray-700">
                    Show item codes/SKUs on line items
                  </span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={profile?.show_item_descriptions || false}
                    onChange={(e) => updateField('show_item_descriptions', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-3 text-sm text-gray-700">
                    Show detailed item descriptions
                  </span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={profile?.show_payment_qr || false}
                    onChange={(e) => updateField('show_payment_qr', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-3 text-sm text-gray-700">
                    Show QR code for payment (invoices only)
                  </span>
                </label>
              </div>
            </div>

            {/* Custom Header */}
            <div className="mb-8">
              <h4 className="text-md font-medium text-gray-900 mb-4">Custom Header</h4>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Header Banner Image URL
                </label>
                <input
                  type="url"
                  value={profile?.header_image_url || ''}
                  onChange={(e) => updateField('header_image_url', e.target.value)}
                  placeholder="https://example.com/header-banner.jpg"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Optional banner image displayed at the top of PDFs (recommended: 1200x200px)
                </p>
              </div>
            </div>

            {/* Custom Footer */}
            <div className="mb-8">
              <h4 className="text-md font-medium text-gray-900 mb-4">Custom Footer</h4>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Footer Text
                </label>
                <textarea
                  value={profile?.footer_text || ''}
                  onChange={(e) => updateField('footer_text', e.target.value)}
                  placeholder="e.g., Thank you for your business! We are fully insured and registered with..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Custom text displayed at the bottom of invoices and quotes
                </p>
              </div>
            </div>

            {/* Preview Buttons */}
            <div className="mb-8">
              <h4 className="text-md font-medium text-gray-900 mb-4">Live Preview</h4>
              <p className="text-sm text-gray-600 mb-4">
                Preview how your invoices and quotes will look with your current settings
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => window.open('http://localhost:3000/api/preview/invoice', '_blank')}
                  className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm"
                >
                  <span>👁️</span>
                  <span>Preview Invoice</span>
                </button>
                <button
                  onClick={() => window.open('http://localhost:3000/api/preview/quote', '_blank')}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
                >
                  <span>👁️</span>
                  <span>Preview Quote</span>
                </button>
              </div>
            </div>

            {/* Preview Note */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                💡 <strong>Tip:</strong> Changes to templates will be reflected when you generate invoices and quotes. Your company logo and brand color from the Business Profile section are automatically included. Save your changes and refresh the preview to see updates.
              </p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
