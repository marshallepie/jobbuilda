'use client';

import AppLayout from '@/components/AppLayout';

export default function ReportsPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="mt-2 text-gray-600">Business analytics and insights</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              📊 Profit & Loss
            </h3>
            <p className="text-gray-600">
              View your P&L statement for any date range
            </p>
          </div>
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              📈 VAT Returns
            </h3>
            <p className="text-gray-600">
              HMRC MTD compliant VAT return generation
            </p>
          </div>
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              💼 Job Profitability
            </h3>
            <p className="text-gray-600">
              Analyze profit margins by job
            </p>
          </div>
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              📅 Time Analytics
            </h3>
            <p className="text-gray-600">
              Track time spent on jobs and tasks
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
