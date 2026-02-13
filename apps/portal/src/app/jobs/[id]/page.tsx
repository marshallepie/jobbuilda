'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import ProtectedLayout from '@/components/ProtectedLayout';
import { formatCurrency, formatDate, getJobStatusColor } from '@/lib/utils';
import Link from 'next/link';

interface Job {
  id: string;
  job_number: string;
  title: string;
  description: string;
  status: string;
  start_date: string;
  estimated_completion: string;
  actual_completion: string;
  site_address: string;
}

export default function JobDetailPage() {
  const params = useParams();
  const jobId = params.id as string;
  const [job, setJob] = useState<Job | null>(null);
  const [variations, setVariations] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadJob = async () => {
      try {
        const [jobData, variationsData, invoicesData] = await Promise.all([
          api.getJob(jobId) as Promise<Job>,
          api.getJobVariations(jobId).catch(() => []) as Promise<any[]>,
          api.getJobInvoices(jobId).catch(() => []) as Promise<any[]>,
        ]);

        setJob(jobData);
        setVariations(variationsData || []);
        setInvoices(invoicesData || []);
      } catch (err) {
        console.error('Failed to load job:', err);
        setError(err instanceof ApiError ? err.message : 'Failed to load job');
      } finally {
        setLoading(false);
      }
    };

    loadJob();
  }, [jobId]);

  if (loading) {
    return (
      <ProtectedLayout>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </ProtectedLayout>
    );
  }

  if (error || !job) {
    return (
      <ProtectedLayout>
        <div className="text-center py-12 text-red-600">
          {error || 'Job not found'}
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">{job.job_number}</p>
              <h1 className="text-3xl font-bold text-gray-900 mt-1">{job.title}</h1>
              {job.description && (
                <p className="mt-2 text-gray-600">{job.description}</p>
              )}
            </div>
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${getJobStatusColor(job.status)}`}>
              {job.status.replace('_', ' ')}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Start Date</p>
              <p className="text-gray-900 font-medium">{formatDate(job.start_date)}</p>
            </div>
            {job.estimated_completion && (
              <div>
                <p className="text-sm text-gray-500">Estimated Completion</p>
                <p className="text-gray-900 font-medium">{formatDate(job.estimated_completion)}</p>
              </div>
            )}
            {job.actual_completion && (
              <div>
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-gray-900 font-medium">{formatDate(job.actual_completion)}</p>
              </div>
            )}
            {job.site_address && (
              <div>
                <p className="text-sm text-gray-500">Site Address</p>
                <p className="text-gray-900 font-medium">{job.site_address}</p>
              </div>
            )}
          </div>
        </div>

        {/* Variations */}
        {variations.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Variations</h2>
            <div className="space-y-3">
              {variations.map((variation) => (
                <div key={variation.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{variation.variation_number}</p>
                    <p className="text-sm text-gray-600">{variation.description}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {formatCurrency(variation.total_inc_vat)}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      variation.status === 'approved' ? 'bg-green-100 text-green-800' :
                      variation.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {variation.status}
                    </span>
                    {variation.status === 'pending' && (
                      <Link
                        href={`/variations/${variation.id}`}
                        className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                      >
                        Review
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Invoices */}
        {invoices.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Invoices</h2>
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{invoice.invoice_number}</p>
                    <p className="text-sm text-gray-600">
                      Issued: {formatDate(invoice.invoice_date)}
                      {invoice.due_date && ` • Due: ${formatDate(invoice.due_date)}`}
                    </p>
                    <p className="text-sm font-medium text-gray-900 mt-1">
                      {formatCurrency(invoice.total_inc_vat)}
                      {parseFloat(invoice.amount_due) > 0 && (
                        <span className="text-red-600"> ({formatCurrency(invoice.amount_due)} due)</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Link
                      href={`/invoices/${invoice.id}`}
                      className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                    >
                      View
                    </Link>
                    {invoice.status === 'sent' && parseFloat(invoice.amount_due) > 0 && (
                      <Link
                        href={`/payment/${invoice.id}`}
                        className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                      >
                        Pay Now
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
