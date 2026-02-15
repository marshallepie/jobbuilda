'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import { api } from '@/lib/api';
import { formatDate, formatCurrency, getStatusColor } from '@/lib/utils';

interface Site {
  id: string;
  name: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  county?: string;
  postcode?: string;
  notes?: string;
  created_at: string;
}

interface Job {
  id: string;
  job_number: string;
  title: string;
  status: string;
  created_at: string;
}

interface Quote {
  id: string;
  quote_number: string;
  title: string;
  status: string;
  total_inc_vat: number;
  created_at: string;
}

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  company?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  county?: string;
  postcode?: string;
  notes?: string;
  gdpr_consent: boolean;
  created_at: string;
  updated_at: string;
}

export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params?.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (clientId) {
      loadClientDetails();
    }
  }, [clientId]);

  const loadClientDetails = async () => {
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

      // Load related data in parallel
      Promise.all([
        loadSites(),
        loadJobs(),
        loadQuotes(),
      ]);
    } catch (err) {
      console.error('Failed to load client:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSites = async () => {
    try {
      const data = await api.request(`/api/clients/clients/${clientId}/sites`) as any;
      const siteList = Array.isArray(data) ? data : (data.data || []);
      setSites(siteList);
    } catch (err) {
      console.error('Failed to load sites:', err);
    }
  };

  const loadJobs = async () => {
    try {
      const data = await api.getJobs() as any;
      const jobList = Array.isArray(data) ? data : (data.data || []);
      // Filter jobs for this client
      const clientJobs = jobList.filter((job: any) => job.client_id === clientId);
      setJobs(clientJobs);
    } catch (err) {
      console.error('Failed to load jobs:', err);
    }
  };

  const loadQuotes = async () => {
    try {
      const data = await api.getQuotes() as any;
      const quoteList = Array.isArray(data) ? data : (data.data || []);
      // Filter quotes for this client
      const clientQuotes = quoteList.filter((quote: any) => quote.client_id === clientId);
      setQuotes(clientQuotes);
    } catch (err) {
      console.error('Failed to load quotes:', err);
    }
  };

  const handleGdprExport = async () => {
    if (!client) return;

    if (confirm(`Export all data for ${client.name}? This will generate a GDPR-compliant data export.`)) {
      setActionLoading(true);
      try {
        // TODO: Implement GDPR export
        alert('GDPR export functionality will be implemented');
      } catch (err: any) {
        console.error('Failed to export data:', err);
        alert(err.message || 'Failed to export data. Please try again.');
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleGdprDelete = async () => {
    if (!client) return;

    if (confirm(`DELETE all data for ${client.name}? This action CANNOT be undone and will remove all associated quotes, jobs, and invoices.`)) {
      setActionLoading(true);
      try {
        // TODO: Implement GDPR delete
        alert('GDPR delete functionality will be implemented');
        // router.push('/clients');
      } catch (err: any) {
        console.error('Failed to delete client data:', err);
        alert(err.message || 'Failed to delete client data. Please try again.');
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

  const fullAddress = [
    client.address_line1,
    client.address_line2,
    client.city,
    client.county,
    client.postcode
  ].filter(Boolean).join(', ');

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <Link
                href="/clients"
                className="text-gray-400 hover:text-gray-600"
              >
                ← Back
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">{client.name}</h1>
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                client.gdpr_consent
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {client.gdpr_consent ? 'GDPR Consented' : 'No GDPR Consent'}
              </span>
            </div>
            {client.company && (
              <p className="text-gray-600 mt-1">{client.company}</p>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleGdprExport}
              disabled={actionLoading}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              GDPR Export
            </button>
            <button
              onClick={handleGdprDelete}
              disabled={actionLoading}
              className="px-4 py-2 text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              GDPR Delete
            </button>
          </div>
        </div>

        {/* Client Details Card */}
        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p className="mt-1 text-gray-900">{client.email || 'Not provided'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Phone</label>
                <p className="mt-1 text-gray-900">{client.phone || 'Not provided'}</p>
              </div>
              {client.mobile && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Mobile</label>
                  <p className="mt-1 text-gray-900">{client.mobile}</p>
                </div>
              )}
              {fullAddress && (
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-500">Address</label>
                  <p className="mt-1 text-gray-900">{fullAddress}</p>
                </div>
              )}
              {client.notes && (
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-500">Notes</label>
                  <p className="mt-1 text-gray-900">{client.notes}</p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Account Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-500">Client Since</label>
                <p className="mt-1 text-gray-900">{formatDate(client.created_at)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Last Updated</label>
                <p className="mt-1 text-gray-900">{formatDate(client.updated_at)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="text-sm text-gray-500">Sites</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {Array.isArray(sites) ? sites.length : 0}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {Array.isArray(sites) && sites.length === 1 ? 'location' : 'locations'}
            </div>
          </div>
          <div className="bg-white shadow rounded-lg p-6">
            <div className="text-sm text-gray-500">Jobs</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {Array.isArray(jobs) ? jobs.length : 0}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {Array.isArray(jobs) && jobs.length === 1 ? 'job' : 'jobs'}
            </div>
          </div>
          <div className="bg-white shadow rounded-lg p-6">
            <div className="text-sm text-gray-500">Quotes</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {Array.isArray(quotes) ? quotes.length : 0}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {Array.isArray(quotes) && quotes.length === 1 ? 'quote' : 'quotes'}
            </div>
          </div>
        </div>

        {/* Sites */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Sites</h2>
            <Link
              href={`/clients/${clientId}/sites/new`}
              className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
            >
              + Add Site
            </Link>
          </div>
          {!Array.isArray(sites) || sites.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No sites added yet
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {sites.map((site) => (
                <div key={site.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{site.name}</h3>
                      {(site.address_line1 || site.city || site.postcode) && (
                        <p className="text-sm text-gray-600 mt-1">
                          {[site.address_line1, site.city, site.postcode].filter(Boolean).join(', ')}
                        </p>
                      )}
                      {site.notes && (
                        <p className="text-sm text-gray-500 mt-1">{site.notes}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      Added {formatDate(site.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Jobs */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Jobs</h2>
            <Link
              href="/jobs"
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              View All →
            </Link>
          </div>
          {!Array.isArray(jobs) || jobs.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No jobs yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Job Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {jobs.slice(0, 5).map((job) => (
                    <tr key={job.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {job.job_number}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {job.title}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(job.status)}`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(job.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          href={`/jobs/${job.id}`}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Quotes */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Quotes</h2>
            <Link
              href="/quotes"
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              View All →
            </Link>
          </div>
          {!Array.isArray(quotes) || quotes.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No quotes yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Quote Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {quotes.slice(0, 5).map((quote) => (
                    <tr key={quote.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {quote.quote_number}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {quote.title}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(quote.status)}`}>
                          {quote.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatCurrency(quote.total_inc_vat)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(quote.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          href={`/quotes/${quote.id}`}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
