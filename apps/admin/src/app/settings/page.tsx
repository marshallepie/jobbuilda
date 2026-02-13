'use client';

import AppLayout from '@/components/AppLayout';

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="mt-2 text-gray-600">Configure your business settings</p>
        </div>
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              🏢 Business Profile
            </h3>
            <p className="text-gray-600 text-sm">
              Company name, address, registration numbers
            </p>
          </div>
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              👥 Team Members
            </h3>
            <p className="text-gray-600 text-sm">
              Manage users and permissions
            </p>
          </div>
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              💳 Integrations
            </h3>
            <p className="text-gray-600 text-sm">
              Connect Stripe, accounting software, suppliers
            </p>
          </div>
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              📋 Templates
            </h3>
            <p className="text-gray-600 text-sm">
              Quote and invoice templates
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
