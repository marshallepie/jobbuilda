'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import { api } from '@/lib/api';

interface Client {
  id: string;
  name: string;
}

interface Site {
  id: string;
  name: string;
  address_line1?: string;
  city?: string;
  postcode?: string;
}

export default function NewJobPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');

  const [formData, setFormData] = useState({
    client_id: '',
    site_id: '',
    title: '',
    description: '',
    scheduled_start: '',
    scheduled_end: '',
    estimated_hours: '',
  });

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      loadClientSites(selectedClientId);
    } else {
      setSites([]);
      setFormData(prev => ({ ...prev, site_id: '' }));
    }
  }, [selectedClientId]);

  const loadClients = async () => {
    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      const data = await api.request('/api/clients/clients') as any;
      const clientList = Array.isArray(data) ? data : (data.data || []);
      setClients(clientList);
    } catch (err) {
      console.error('Failed to load clients:', err);
    }
  };

  const loadClientSites = async (clientId: string) => {
    try {
      const data = await api.request(`/api/clients/clients/${clientId}/sites`) as any;
      const siteList = Array.isArray(data) ? data : (data.data || []);
      setSites(siteList);
    } catch (err) {
      console.error('Failed to load sites:', err);
      setSites([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.client_id || !formData.site_id || !formData.title) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      const jobData = {
        client_id: formData.client_id,
        site_id: formData.site_id,
        title: formData.title,
        description: formData.description || undefined,
        scheduled_start: formData.scheduled_start || undefined,
        scheduled_end: formData.scheduled_end || undefined,
        estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : undefined,
      };

      // Note: This creates a job without a quote
      // The API might need to be adjusted to support this
      const response = await api.request('/api/jobs', {
        method: 'POST',
        body: JSON.stringify(jobData),
      }) as any;

      const job = response.data || response;
      alert(`Job ${job.job_number} created successfully!`);
      router.push(`/jobs`);
    } catch (err: any) {
      console.error('Failed to create job:', err);
      alert(err.message || 'Failed to create job. Note: Jobs are typically created from approved quotes.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Create New Job</h1>
            <p className="text-gray-600 mt-1">Schedule a new job manually</p>
          </div>
          <Link
            href="/jobs"
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Back to Jobs
          </Link>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Note:</strong> Jobs are typically created automatically from approved quotes.
            Use this form only for manual job creation without a quote.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">
          {/* Client Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Client <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.client_id}
              onChange={(e) => {
                setFormData({ ...formData, client_id: e.target.value });
                setSelectedClientId(e.target.value);
              }}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select a client...</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>

          {/* Site Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Site <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.site_id}
              onChange={(e) => setFormData({ ...formData, site_id: e.target.value })}
              required
              disabled={!selectedClientId || sites.length === 0}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100"
            >
              <option value="">
                {!selectedClientId ? 'Select a client first...' : sites.length === 0 ? 'No sites available' : 'Select a site...'}
              </option>
              {sites.map(site => (
                <option key={site.id} value={site.id}>
                  {site.name} {site.postcode && `- ${site.postcode}`}
                </option>
              ))}
            </select>
          </div>

          {/* Job Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Job Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              placeholder="e.g., Kitchen Rewiring"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              placeholder="Job description and notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Scheduled Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Scheduled Start Date
              </label>
              <input
                type="date"
                value={formData.scheduled_start}
                onChange={(e) => setFormData({ ...formData, scheduled_start: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Scheduled End Date
              </label>
              <input
                type="date"
                value={formData.scheduled_end}
                onChange={(e) => setFormData({ ...formData, scheduled_end: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Estimated Hours */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estimated Hours
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={formData.estimated_hours}
              onChange={(e) => setFormData({ ...formData, estimated_hours: e.target.value })}
              placeholder="e.g., 8"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Link
              href="/jobs"
              className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Job'}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
