'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import { api } from '@/lib/api';

interface Site {
  id: string;
  client_id: string;
  name: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  county?: string;
  postcode?: string;
  contact_name?: string;
  contact_phone?: string;
  access_notes?: string;
}

interface Client {
  id: string;
  name: string;
}

export default function EditSitePage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params?.id as string;
  const siteId = params?.siteId as string;

  const [client, setClient] = useState<Client | null>(null);
  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    county: '',
    postcode: '',
    contact_name: '',
    contact_phone: '',
    access_notes: '',
  });

  useEffect(() => {
    if (clientId && siteId) {
      loadData();
    }
  }, [clientId, siteId]);

  const loadData = async () => {
    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      // Load client and site data
      const [clientData, siteData] = await Promise.all([
        api.request(`/api/clients/clients/${clientId}`) as Promise<any>,
        api.request(`/api/clients/sites/${siteId}`) as Promise<any>,
      ]);

      setClient(clientData);
      setSite(siteData);

      // Populate form
      setFormData({
        name: siteData.name || '',
        address_line1: siteData.address_line1 || '',
        address_line2: siteData.address_line2 || '',
        city: siteData.city || '',
        county: siteData.county || '',
        postcode: siteData.postcode || '',
        contact_name: siteData.contact_name || '',
        contact_phone: siteData.contact_phone || '',
        access_notes: siteData.access_notes || '',
      });
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      alert('Please enter a site name');
      return;
    }

    setSaving(true);
    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      const siteData = {
        name: formData.name,
        address_line1: formData.address_line1 || undefined,
        address_line2: formData.address_line2 || undefined,
        city: formData.city || undefined,
        county: formData.county || undefined,
        postcode: formData.postcode || undefined,
        contact_name: formData.contact_name || undefined,
        contact_phone: formData.contact_phone || undefined,
        access_notes: formData.access_notes || undefined,
      };

      await api.request(`/api/clients/sites/${siteId}`, {
        method: 'PATCH',
        body: JSON.stringify(siteData),
      });

      alert('Site updated successfully!');
      router.push(`/clients/${clientId}/sites`);
    } catch (err: any) {
      console.error('Failed to update site:', err);
      alert(err.message || 'Failed to update site. Please try again.');
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

  if (!client || !site) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Site Not Found</h2>
          <p className="text-gray-600 mb-6">The site you're looking for doesn't exist.</p>
          <Link
            href="/clients"
            className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Back to Clients
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Edit Site</h1>
            <p className="text-gray-600 mt-1">Update site information for {client.name}</p>
          </div>
          <Link
            href={`/clients/${clientId}/sites`}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Back to Sites
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">
          {/* Site Name */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Site Information</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Site Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g., Main Office, Factory, Home"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Address</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address Line 1
                </label>
                <input
                  type="text"
                  value={formData.address_line1}
                  onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                  placeholder="123 Main Street"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address Line 2
                </label>
                <input
                  type="text"
                  value={formData.address_line2}
                  onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                  placeholder="Unit 5, Building B (optional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="London"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    County
                  </label>
                  <input
                    type="text"
                    value={formData.county}
                    onChange={(e) => setFormData({ ...formData, county: e.target.value })}
                    placeholder="Greater London"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Postcode
                  </label>
                  <input
                    type="text"
                    value={formData.postcode}
                    onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                    placeholder="SW1A 1AA"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Site Contact */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Site Contact (Optional)</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    placeholder="e.g., Site Manager"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    placeholder="07700 900123"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Access Notes */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Access Notes</h2>
            <textarea
              value={formData.access_notes}
              onChange={(e) => setFormData({ ...formData, access_notes: e.target.value })}
              rows={4}
              placeholder="Parking instructions, gate codes, access restrictions, etc..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Link
              href={`/clients/${clientId}/sites`}
              className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
