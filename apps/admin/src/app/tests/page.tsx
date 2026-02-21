'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import { api, ApiError } from '@/lib/api';
import { formatDate, getStatusColor } from '@/lib/utils';

interface Test {
  id: string;
  test_number: string;
  test_type: string;
  title: string;
  status: string;
  outcome?: string;
  test_date?: string;
  completion_date?: string;
  job_id: string;
  client_name?: string;
  site_name?: string;
}

export default function TestsPage() {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    loadTests();
  }, []);

  const loadTests = async () => {
    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      const data = await api.get('/api/tests') as Test[];
      setTests(data);
    } catch (err) {
      console.error('Failed to load tests:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTests = tests.filter((test) => {
    if (filter !== 'all' && test.status !== filter) return false;
    if (typeFilter !== 'all' && test.test_type !== typeFilter) return false;
    return true;
  });

  // Calculate summary stats
  const stats = {
    total: tests.length,
    pending: tests.filter(t => t.status === 'scheduled' || t.status === 'draft').length,
    in_progress: tests.filter(t => t.status === 'in_progress').length,
    completed: tests.filter(t => t.status === 'completed').length,
    failed: tests.filter(t => t.outcome === 'unsatisfactory').length,
  };

  const getTestTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      eicr: 'EICR',
      eic: 'EIC',
      initial_verification: 'EIC',
      minor_works: 'Minor Works',
      pat: 'PAT',
      periodic_inspection: 'Periodic',
    };
    return labels[type] || type;
  };

  const getOutcomeBadge = (outcome?: string) => {
    if (!outcome) return null;
    const colors: Record<string, string> = {
      satisfactory: 'bg-green-100 text-green-800',
      unsatisfactory: 'bg-red-100 text-red-800',
      requires_improvement: 'bg-yellow-100 text-yellow-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[outcome] || 'bg-gray-100 text-gray-800'}`}>
        {outcome.replace('_', ' ')}
      </span>
    );
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

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Electrical Tests</h1>
            <p className="mt-2 text-gray-600">BS 7671 compliance testing and certification</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm font-medium text-gray-600">Total Tests</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm font-medium text-gray-600">Pending</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{stats.pending}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm font-medium text-gray-600">In Progress</div>
            <div className="text-2xl font-bold text-orange-600 mt-1">{stats.in_progress}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm font-medium text-gray-600">Completed</div>
            <div className="text-2xl font-bold text-green-600 mt-1">{stats.completed}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm font-medium text-gray-600">Failed</div>
            <div className="text-2xl font-bold text-red-600 mt-1">{stats.failed}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex space-x-2">
            <span className="text-sm font-medium text-gray-700 self-center">Status:</span>
            {['all', 'draft', 'scheduled', 'in_progress', 'completed'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === status
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {status === 'all' ? 'All' : status.replace('_', ' ')}
              </button>
            ))}
          </div>
          <div className="flex space-x-2">
            <span className="text-sm font-medium text-gray-700 self-center">Type:</span>
            {['all', 'eicr', 'eic', 'minor_works'].map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  typeFilter === type
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {type === 'all' ? 'All Types' : getTestTypeLabel(type)}
              </button>
            ))}
          </div>
        </div>

        {/* Tests Table */}
        {filteredTests.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-12 text-center">
            <div className="text-6xl mb-4">⚡</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No tests found
            </h3>
            <p className="text-gray-600 mb-6">
              Tests are created from jobs with electrical work
            </p>
            <Link
              href="/jobs"
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              View Jobs
            </Link>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Test Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client / Site
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Outcome
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTests.map((test) => (
                  <tr key={test.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/tests/${test.id}`}
                        className="text-primary-600 hover:text-primary-900 font-medium"
                      >
                        {test.test_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                        {getTestTypeLabel(test.test_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{test.client_name || 'Unknown Client'}</div>
                      <div className="text-sm text-gray-500">{test.site_name || 'Unknown Site'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {test.completion_date
                        ? formatDate(test.completion_date)
                        : test.test_date
                        ? formatDate(test.test_date)
                        : 'Not scheduled'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(test.status)}`}>
                        {test.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getOutcomeBadge(test.outcome)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/tests/${test.id}`}
                        className="text-primary-600 hover:text-primary-900 mr-4"
                      >
                        View
                      </Link>
                      {test.status !== 'completed' && (
                        <Link
                          href={`/tests/${test.id}/record`}
                          className="text-green-600 hover:text-green-900"
                        >
                          Record
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
