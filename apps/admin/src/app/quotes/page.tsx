'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import { api, ApiError } from '@/lib/api';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';

interface Quote {
  id: string;
  quote_number: string;
  title: string;
  status: string;
  total_inc_vat: string;
  valid_until: string;
  client_name?: string;
  created_at: string;
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadQuotes();
  }, []);

  const loadQuotes = async () => {
    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      const data = await api.getQuotes() as Quote[];
      setQuotes(data);
    } catch (err) {
      console.error('Failed to load quotes:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteQuote = async (quoteId: string, quoteNumber: string) => {
    if (confirm(`Are you sure you want to delete quote ${quoteNumber}? This action cannot be undone.`)) {
      try {
        const mockAuth = {
          token: 'mock-jwt-token',
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
          user_id: '550e8400-e29b-41d4-a716-446655440001',
        };
        api.setAuth(mockAuth);

        await api.request(`/api/quotes/${quoteId}`, {
          method: 'DELETE',
        });

        // Reload quotes list
        await loadQuotes();
      } catch (err: any) {
        console.error('Failed to delete quote:', err);
        alert(err.message || 'Failed to delete quote. Please try again.');
      }
    }
  };

  const filteredQuotes = quotes.filter((quote) => {
    if (filter === 'all') return true;
    return quote.status === filter;
  });

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Quotes</h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">Create and manage quotes</p>
          </div>
          <Link
            href="/quotes/new"
            className="inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm sm:text-base"
          >
            + New Quote
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {['all', 'draft', 'sent', 'approved', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                filter === status
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {status === 'all' ? 'All' : status}
            </button>
          ))}
        </div>

        {/* Quotes Table */}
        {filteredQuotes.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-12 text-center">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No quotes found
            </h3>
            <p className="text-gray-600 mb-6">
              {filter === 'all'
                ? 'Create your first quote to start winning work'
                : `No ${filter} quotes`}
            </p>
            <Link
              href="/quotes/new"
              className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              Create First Quote
            </Link>
          </div>
        ) : (
          <>
          {/* Desktop table view */}
          <div className="hidden md:block bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quote
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valid Until
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredQuotes.map((quote) => (
                  <tr key={quote.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{quote.quote_number}</div>
                      <div className="text-sm font-medium text-gray-900">{quote.title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {quote.client_name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {formatCurrency(quote.total_inc_vat)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(quote.status)}`}>
                        {quote.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(quote.valid_until)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/quotes/${quote.id}`}
                        className="text-primary-600 hover:text-primary-700 mr-4"
                      >
                        View
                      </Link>
                      {quote.status !== 'approved' && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            deleteQuote(quote.id, quote.quote_number);
                          }}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card view */}
          <div className="md:hidden space-y-4">
            {filteredQuotes.map((quote) => (
              <div key={quote.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500">{quote.quote_number}</p>
                    <p className="text-sm font-medium text-gray-900 mt-1 truncate">{quote.title}</p>
                  </div>
                  <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${getStatusColor(quote.status)}`}>
                    {quote.status}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Client:</span>
                    <span className="font-medium text-gray-900">{quote.client_name || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Amount:</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(quote.total_inc_vat)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Valid Until:</span>
                    <span className="text-gray-900">{formatDate(quote.valid_until)}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end space-x-3 pt-3 border-t border-gray-200">
                  <Link
                    href={`/quotes/${quote.id}`}
                    className="text-sm font-medium text-primary-600 hover:text-primary-700"
                  >
                    View
                  </Link>
                  {quote.status !== 'approved' && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        deleteQuote(quote.id, quote.quote_number);
                      }}
                      className="text-sm font-medium text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
