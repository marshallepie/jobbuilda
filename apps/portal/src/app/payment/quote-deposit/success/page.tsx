'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function SuccessContent() {
  const searchParams = useSearchParams();
  const quoteId = searchParams.get('quote_id');

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-md p-10 max-w-lg w-full text-center">
        {/* Green checkmark */}
        <div className="flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mx-auto mb-6">
          <svg
            className="h-10 w-10 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-3">Deposit Paid!</h1>

        <p className="text-lg text-gray-700 mb-4">
          Thank you for your payment. Your deposit has been received.
        </p>

        <p className="text-gray-600 mb-4">
          An engineer has been assigned to your job and will be in touch shortly to arrange access
          to the premises.
        </p>

        <p className="text-sm text-gray-500 mb-8">
          Please keep this confirmation for your records.
          {quoteId && (
            <span className="block mt-1 font-mono text-xs text-gray-400">
              Reference: {quoteId}
            </span>
          )}
        </p>

        <div className="border-t border-gray-100 pt-6">
          <div className="flex items-center justify-center gap-2 text-green-700">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <span className="text-sm font-medium">Payment processed securely</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function QuoteDepositSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
