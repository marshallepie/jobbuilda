'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import { api, ApiError } from '@/lib/api';
import { formatDate, getStatusColor } from '@/lib/utils';

interface Lead {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  description?: string;
  source?: string;
  status: string;
  assigned_to?: string;
  notes?: string;
  client_id?: string;
  created_at: string;
  updated_at: string;
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) loadLead();
  }, [id]);

  const loadLead = async () => {
    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);
      const data = await api.getLead(id) as Lead;
      setLead(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load lead');
    } finally {
      setLoading(false);
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

  if (error || !lead) {
    return (
      <AppLayout>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error || 'Lead not found'}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <Link href="/leads" className="text-teal-600 hover:text-teal-700 text-sm mb-2 inline-block">
              ← Back to Leads
            </Link>
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-wider mb-1">Lead</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{lead.name}</h1>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(lead.status)}`}>
                {lead.status}
              </span>
            </div>
            <p className="text-gray-500 text-sm mt-1">Created {formatDate(lead.created_at)}</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-shrink-0">
            <button
              onClick={() => router.push(`/quotes/new?lead_id=${lead.id}`)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
            >
              Create Quote
            </button>
          </div>
        </div>

        {/* Contact Details */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Details</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {lead.email && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Email</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  <a href={`mailto:${lead.email}`} className="text-primary-600 hover:underline">
                    {lead.email}
                  </a>
                </dd>
              </div>
            )}
            {lead.phone && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Phone</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  <a href={`tel:${lead.phone}`} className="text-primary-600 hover:underline">
                    {lead.phone}
                  </a>
                </dd>
              </div>
            )}
            {lead.address && (
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Address</dt>
                <dd className="mt-1 text-sm text-gray-900">{lead.address}</dd>
              </div>
            )}
            {lead.source && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Source</dt>
                <dd className="mt-1 text-sm text-gray-900 capitalize">{lead.source.replace('_', ' ')}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Work Description */}
        {lead.description && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Work Description</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{lead.description}</p>
          </div>
        )}

        {/* Notes */}
        {lead.notes && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Notes</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{lead.notes}</p>
          </div>
        )}

        {/* Next Step */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-1">Next Step</h3>
          <p className="text-sm text-blue-800">
            Ready to proceed? Click <strong>Create Quote</strong> to build a detailed quote for this lead.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
