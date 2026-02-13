'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import ProtectedLayout from '@/components/ProtectedLayout';
import { formatCurrency, formatDate, getJobStatusColor, getInvoiceStatusColor } from '@/lib/utils';
import Link from 'next/link';

interface Job {
  id: string;
  job_number: string;
  title: string;
  status: string;
  start_date: string;
  estimated_completion: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  invoice_date: string;
  due_date: string;
  total_inc_vat: string;
  amount_due: string;
}

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const auth = api.loadAuth();
        if (!auth?.client_id) {
          throw new Error('Client ID not found in auth context');
        }

        const [jobsData, jobInvoicesData] = await Promise.all([
          api.getJobsByClient(auth.client_id) as Promise<Job[]>,
          // Get invoices for each job - simplified for now
          api.getJobs().then((jobs) => {
            return Promise.all(
              (jobs as Job[]).map((job) => api.getJobInvoices(job.id))
            ).then(results => results.flat());
          }).catch(() => []) as Promise<Invoice[]>,
        ]);

        setJobs(jobsData || []);
        setInvoices(jobInvoicesData || []);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
        setError(err instanceof ApiError ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <ProtectedLayout>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </ProtectedLayout>
    );
  }

  if (error) {
    return (
      <ProtectedLayout>
        <div className="text-center py-12">
          <div className="text-red-600">{error}</div>
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Welcome back! Here&apos;s an overview of your projects and invoices.
          </p>
        </div>

        {/* Jobs Section */}
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Your Jobs</h2>
          {jobs.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-6 text-center text-gray-500">
              No jobs found
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {jobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-gray-500">{job.job_number}</p>
                      <h3 className="text-lg font-semibold text-gray-900 mt-1">
                        {job.title}
                      </h3>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getJobStatusColor(job.status)}`}>
                      {job.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="mt-4 space-y-1 text-sm text-gray-600">
                    <p>Start: {formatDate(job.start_date)}</p>
                    {job.estimated_completion && (
                      <p>Est. Completion: {formatDate(job.estimated_completion)}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Invoices Section */}
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Recent Invoices</h2>
          {invoices.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-6 text-center text-gray-500">
              No invoices found
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invoice
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invoices.slice(0, 5).map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {invoice.invoice_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(invoice.invoice_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(invoice.total_inc_vat)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getInvoiceStatusColor(invoice.status)}`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <Link
                          href={`/invoices/${invoice.id}`}
                          className="text-primary-600 hover:text-primary-700 font-medium"
                        >
                          View
                        </Link>
                        {invoice.status === 'sent' && parseFloat(invoice.amount_due) > 0 && (
                          <>
                            {' · '}
                            <Link
                              href={`/payment/${invoice.id}`}
                              className="text-primary-600 hover:text-primary-700 font-medium"
                            >
                              Pay Now
                            </Link>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </ProtectedLayout>
  );
}
