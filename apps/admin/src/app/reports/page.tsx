'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

interface ReportData {
  revenue: {
    total: number;
    byMonth: { month: string; amount: number }[];
  };
  expenses: {
    total: number;
    materials: number;
    labor: number;
  };
  profit: number;
  profitMargin: number;
  jobs: {
    completed: number;
    inProgress: number;
    total: number;
    avgValue: number;
  };
  invoices: {
    paid: number;
    unpaid: number;
    overdue: number;
    totalOutstanding: number;
  };
}

export default function ReportsPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'quarter' | 'year'>('month');

  useEffect(() => {
    loadReportData();
  }, [selectedPeriod]);

  const loadReportData = async () => {
    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      // Fetch all data
      const [jobs, invoices] = await Promise.all([
        api.getJobs() as Promise<any[]>,
        api.request('/api/invoices') as Promise<any[]>,
      ]);

      // Calculate date range based on selected period
      const now = new Date();
      let startDate: Date;
      if (selectedPeriod === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (selectedPeriod === 'quarter') {
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
      } else {
        startDate = new Date(now.getFullYear(), 0, 1);
      }

      // Filter data by period
      const periodInvoices = invoices.filter((inv) => new Date(inv.created_at) >= startDate);
      const periodJobs = jobs.filter((job) => new Date(job.created_at) >= startDate);

      // Calculate revenue
      const paidInvoices = periodInvoices.filter(
        (inv) => inv.status === 'paid' || inv.status === 'partially_paid'
      );
      const totalRevenue = paidInvoices.reduce((sum, inv) => {
        return sum + parseFloat(inv.amount_paid || '0');
      }, 0);

      // Calculate revenue by month (last 6 months)
      const revenueByMonth = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        const monthInvoices = invoices.filter((inv) => {
          const invDate = new Date(inv.created_at);
          return invDate >= monthDate && invDate <= monthEnd && (inv.status === 'paid' || inv.status === 'partially_paid');
        });
        const monthRevenue = monthInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount_paid || '0'), 0);
        revenueByMonth.push({
          month: monthDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
          amount: monthRevenue,
        });
      }

      // Calculate expenses (estimate from materials and time tracking)
      const materialsTotal = periodJobs.reduce((sum, job) => {
        const materials = job.materials_used || [];
        return sum + materials.reduce((mSum: number, m: any) => mSum + (parseFloat(m.unit_cost || '0') * parseFloat(m.quantity_used || '0')), 0);
      }, 0);

      const laborTotal = periodJobs.reduce((sum, job) => {
        const timeEntries = job.time_entries || [];
        return sum + timeEntries.reduce((tSum: number, t: any) => tSum + (parseFloat(t.hours || '0') * 35), 0); // £35/hour rate
      }, 0);

      const totalExpenses = materialsTotal + laborTotal;
      const profit = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

      // Calculate job stats
      const completedJobs = periodJobs.filter((j) => j.status === 'completed').length;
      const inProgressJobs = periodJobs.filter((j) => j.status === 'in_progress').length;
      const avgJobValue = periodJobs.length > 0
        ? periodInvoices.reduce((sum, inv) => sum + parseFloat(inv.total_inc_vat || '0'), 0) / periodJobs.length
        : 0;

      // Calculate invoice stats
      const unpaidInvoices = invoices.filter((inv) => inv.status === 'sent' || inv.status === 'viewed');
      const overdueInvoices = invoices.filter((inv) => inv.status === 'overdue');
      const totalOutstanding = [...unpaidInvoices, ...overdueInvoices].reduce(
        (sum, inv) => sum + parseFloat(inv.amount_due || '0'),
        0
      );

      setReportData({
        revenue: {
          total: totalRevenue,
          byMonth: revenueByMonth,
        },
        expenses: {
          total: totalExpenses,
          materials: materialsTotal,
          labor: laborTotal,
        },
        profit,
        profitMargin,
        jobs: {
          completed: completedJobs,
          inProgress: inProgressJobs,
          total: periodJobs.length,
          avgValue: avgJobValue,
        },
        invoices: {
          paid: paidInvoices.length,
          unpaid: unpaidInvoices.length,
          overdue: overdueInvoices.length,
          totalOutstanding,
        },
      });
    } catch (err) {
      console.error('Failed to load report data:', err);
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

  if (!reportData) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-gray-600">Failed to load report data</p>
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
            <h1 className="text-3xl font-bold text-gray-900">Business Reports</h1>
            <p className="mt-2 text-gray-600">Financial insights and analytics</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSelectedPeriod('month')}
              className={`px-4 py-2 rounded-lg ${
                selectedPeriod === 'month'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setSelectedPeriod('quarter')}
              className={`px-4 py-2 rounded-lg ${
                selectedPeriod === 'quarter'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Quarter
            </button>
            <button
              onClick={() => setSelectedPeriod('year')}
              className={`px-4 py-2 rounded-lg ${
                selectedPeriod === 'year'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Year
            </button>
          </div>
        </div>

        {/* P&L Summary */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">📊 Profit & Loss Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-500">Revenue</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(reportData.revenue.total)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Expenses</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(reportData.expenses.total)}</p>
              <div className="text-xs text-gray-500 mt-1">
                <div>Materials: {formatCurrency(reportData.expenses.materials)}</div>
                <div>Labor: {formatCurrency(reportData.expenses.labor)}</div>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Net Profit</p>
              <p className={`text-2xl font-bold mt-1 ${reportData.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(reportData.profit)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Profit Margin</p>
              <p className={`text-2xl font-bold mt-1 ${reportData.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {reportData.profitMargin.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {/* Revenue Trend */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">📈 Revenue Trend (Last 6 Months)</h2>
          <div className="space-y-3">
            {reportData.revenue.byMonth.map((month, index) => {
              const maxRevenue = Math.max(...reportData.revenue.byMonth.map((m) => m.amount));
              const barWidth = maxRevenue > 0 ? (month.amount / maxRevenue) * 100 : 0;
              return (
                <div key={index} className="flex items-center space-x-4">
                  <div className="w-24 text-sm text-gray-600">{month.month}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-8 relative">
                    <div
                      className="bg-primary-600 h-8 rounded-full flex items-center justify-end px-3 transition-all"
                      style={{ width: `${barWidth}%` }}
                    >
                      {barWidth > 20 && (
                        <span className="text-white text-sm font-medium">{formatCurrency(month.amount)}</span>
                      )}
                    </div>
                    {barWidth <= 20 && (
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm font-medium text-gray-700">
                        {formatCurrency(month.amount)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Jobs & Invoices Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Jobs */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">💼 Job Statistics</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Total Jobs</span>
                <span className="text-xl font-bold text-gray-900">{reportData.jobs.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Completed</span>
                <span className="text-xl font-bold text-green-600">{reportData.jobs.completed}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">In Progress</span>
                <span className="text-xl font-bold text-blue-600">{reportData.jobs.inProgress}</span>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <span className="text-gray-600">Avg Job Value</span>
                <span className="text-xl font-bold text-gray-900">{formatCurrency(reportData.jobs.avgValue)}</span>
              </div>
            </div>
          </div>

          {/* Invoices */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">💰 Invoice Status</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Paid Invoices</span>
                <span className="text-xl font-bold text-green-600">{reportData.invoices.paid}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Unpaid</span>
                <span className="text-xl font-bold text-yellow-600">{reportData.invoices.unpaid}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Overdue</span>
                <span className="text-xl font-bold text-red-600">{reportData.invoices.overdue}</span>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <span className="text-gray-600">Total Outstanding</span>
                <span className="text-xl font-bold text-red-600">{formatCurrency(reportData.invoices.totalOutstanding)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* VAT Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="text-2xl mr-3">ℹ️</div>
            <div>
              <h3 className="text-sm font-semibold text-blue-900">VAT Returns</h3>
              <p className="text-sm text-blue-800 mt-1">
                Detailed VAT returns (HMRC MTD compliant) will be available in a future update. All financial
                calculations include VAT at the standard UK rate of 20%.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
