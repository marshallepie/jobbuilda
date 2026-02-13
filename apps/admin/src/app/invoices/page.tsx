'use client';

import AppLayout from '@/components/AppLayout';

export default function InvoicesPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
          <p className="mt-2 text-gray-600">Generate and manage invoices</p>
        </div>
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">💰</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Invoice Management
          </h3>
          <p className="text-gray-600">
            Full invoice management interface coming soon
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
