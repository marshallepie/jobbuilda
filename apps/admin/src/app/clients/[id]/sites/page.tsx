'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface Site {
  id: string;
  name: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  county?: string;
  postcode?: string;
  contact_name?: string;
  contact_phone?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface Client {
  id: string;
  name: string;
}

export default function ClientSitesPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params?.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (clientId) {
      loadData();
    }
  }, [clientId]);

  const loadData = async () => {
    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      // Load client details
      const clientData = await api.request(`/api/clients/clients/${clientId}`) as any;
      setClient(clientData);

      // Load sites
      const sitesData = await api.request(`/api/clients/clients/${clientId}/sites`) as any;
      const siteList = Array.isArray(sitesData) ? sitesData : (sitesData.data || []);
      setSites(siteList);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSite = async (siteId: string, siteName: string) => {
    if (!confirm(`Delete site "${siteName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.request(`/api/clients/sites/${siteId}`, {
        method: 'DELETE',
      });
      await loadData();
      alert('Site deleted successfully');
    } catch (err: any) {
      console.error('Failed to delete site:', err);
      alert(err.message || 'Failed to delete site. Please try again.');
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

  if (!client) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Client Not Found</h2>
          <p className="text-gray-600 mb-6">The client you're looking for doesn't exist.</p>
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

  const formatAddress = (site: Site) => {
    return [
      site.address_line1,
      site.address_line2,
      site.city,
      site.county,
      site.postcode
    ].filter(Boolean).join(', ');
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <Link
                href={`/clients/${clientId}`}
                className="text-gray-400 hover:text-gray-600"
              >
                ← Back to {client.name}
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mt-2">Sites for {client.name}</h1>
            <p className="text-gray-600 mt-1">Manage locations where work is performed</p>
          </div>

          <Link
            href={`/clients/${clientId}/sites/new`}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            + Add Site
          </Link>
        </div>

        {/* Sites List */}
        {!Array.isArray(sites) || sites.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-12 text-center">
            <div className="text-6xl mb-4">📍</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No sites added yet
            </h3>
            <p className="text-gray-600 mb-6">
              Add a site location where work will be performed for this client
            </p>
            <Link
              href={`/clients/${clientId}/sites/new`}
              className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              Add First Site
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sites.map((site) => (
              <div
                key={site.id}
                className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {site.name}
                    </h3>
                    {formatAddress(site) && (
                      <p className="text-sm text-gray-600 mb-3">
                        📍 {formatAddress(site)}
                      </p>
                    )}
                  </div>
                </div>

                {site.contact_name && (
                  <div className="mb-3 pb-3 border-b border-gray-200">
                    <div className="text-sm text-gray-600">
                      <div>👤 {site.contact_name}</div>
                      {site.contact_phone && (
                        <div>📞 {site.contact_phone}</div>
                      )}
                    </div>
                  </div>
                )}

                {site.notes && (
                  <div className="mb-3">
                    <p className="text-sm text-gray-600">{site.notes}</p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                  <div className="text-xs text-gray-500">
                    Added {formatDate(site.created_at)}
                  </div>
                  <div className="flex items-center space-x-3">
                    <Link
                      href={`/clients/${clientId}/sites/${site.id}/edit`}
                      className="text-sm text-primary-600 hover:text-primary-700"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDeleteSite(site.id, site.name)}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Box */}
        {Array.isArray(sites) && sites.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>Tip:</strong> Sites represent different locations where you perform work for this client.
              Each job and quote can be associated with a specific site.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
