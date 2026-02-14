'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { api, ApiError } from '@/lib/api';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import Link from 'next/link';

interface DashboardStats {
  activeJobs: number;
  pendingQuotes: number;
  unpaidInvoices: number;
  monthlyRevenue: number;
}

interface Job {
  id: string;
  job_number: string;
  title: string;
  status: string;
  start_date: string;
  client_name?: string;
}

interface Quote {
  id: string;
  quote_number: string;
  title: string;
  status: string;
  total_inc_vat: string;
  client_name?: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    activeJobs: 0,
    pendingQuotes: 0,
    unpaidInvoices: 0,
    monthlyRevenue: 0,
  });
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [pendingQuotes, setPendingQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load auth context (in production, this would come from Supabase)
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      // Fetch dashboard data
      const [jobsData, quotesData] = await Promise.all([
        api.getJobs() as Promise<Job[]>,
        api.getQuotes() as Promise<Quote[]>,
      ]);

      // Calculate stats
      const activeJobs = jobsData.filter((j) => j.status === 'in_progress').length;
      const pending = quotesData.filter((q) => q.status === 'sent' || q.status === 'viewed').length;

      setStats({
        activeJobs,
        pendingQuotes: pending,
        unpaidInvoices: 0, // TODO: Calculate from invoices
        monthlyRevenue: 0, // TODO: Calculate from payments
      });

      setRecentJobs(jobsData.slice(0, 5));
      setPendingQuotes(quotesData.filter((q) => q.status === 'sent' || q.status === 'viewed').slice(0, 5));
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setError(err instanceof ApiError ? err.message : 'Failed to load dashboard data');
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

  if (error) {
    return (
      <AppLayout>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Welcome back! Here&apos;s what&apos;s happening with your business.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Active Jobs"
            value={stats.activeJobs}
            icon="🔧"
            color="blue"
          />
          <StatCard
            title="Pending Quotes"
            value={stats.pendingQuotes}
            icon="📝"
            color="yellow"
          />
          <StatCard
            title="Unpaid Invoices"
            value={stats.unpaidInvoices}
            icon="💰"
            color="red"
          />
          <StatCard
            title="Monthly Revenue"
            value={formatCurrency(stats.monthlyRevenue)}
            icon="📈"
            color="green"
          />
        </div>

        {/* Recent Jobs */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Recent Jobs</h2>
            <Link
              href="/jobs"
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              View all →
            </Link>
          </div>
          {recentJobs.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-6 text-center text-gray-500">
              No jobs yet. Create your first job to get started!
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <ul className="divide-y divide-gray-200">
                {recentJobs.map((job) => (
                  <li key={job.id}>
                    <Link
                      href={`/jobs/${job.id}`}
                      className="block hover:bg-gray-50 transition-colors"
                    >
                      <div className="px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">{job.job_number}</p>
                            <p className="text-base font-medium text-gray-900 mt-1">
                              {job.title}
                            </p>
                            {job.client_name && (
                              <p className="text-sm text-gray-500 mt-1">{job.client_name}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(job.status)}`}>
                              {job.status.replace('_', ' ')}
                            </span>
                            <p className="text-sm text-gray-500 mt-1">
                              {formatDate(job.start_date)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Pending Quotes */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Pending Quotes</h2>
            <Link
              href="/quotes"
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              View all →
            </Link>
          </div>
          {pendingQuotes.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-6 text-center text-gray-500">
              No pending quotes at the moment.
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <ul className="divide-y divide-gray-200">
                {pendingQuotes.map((quote) => (
                  <li key={quote.id}>
                    <Link
                      href={`/quotes/${quote.id}`}
                      className="block hover:bg-gray-50 transition-colors"
                    >
                      <div className="px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">{quote.quote_number}</p>
                            <p className="text-base font-medium text-gray-900 mt-1">
                              {quote.title}
                            </p>
                            {quote.client_name && (
                              <p className="text-sm text-gray-500 mt-1">{quote.client_name}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-base font-semibold text-gray-900">
                              {formatCurrency(quote.total_inc_vat)}
                            </p>
                            <span className={`inline-block mt-1 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(quote.status)}`}>
                              {quote.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: 'blue' | 'yellow' | 'red' | 'green';
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    green: 'bg-green-50 text-green-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className={`flex-shrink-0 p-3 rounded-lg ${colorClasses[color]}`}>
          <span className="text-2xl">{icon}</span>
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}
