'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import ProtectedLayout from '@/components/ProtectedLayout';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const invoiceId = searchParams.get('invoice_id');

  return (
    <ProtectedLayout>
      <div className="max-w-md mx-auto">
        <div className="bg-white shadow rounded-lg p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M5 13l4 4L19 7"></path>
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
          <p className="text-gray-600 mb-6">
            Thank you for your payment. Your invoice has been updated.
          </p>

          <div className="space-y-3">
            {invoiceId && (
              <Link
                href={`/invoices/${invoiceId}`}
                className="block w-full bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-md font-medium"
              >
                View Invoice
              </Link>
            )}
            <Link
              href="/dashboard"
              className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-md font-medium"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </ProtectedLayout>
  );
}
