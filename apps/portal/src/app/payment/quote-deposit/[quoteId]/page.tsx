'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function QuoteDepositPage() {
  const params = useParams();
  const quoteId = params.quoteId as string;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!quoteId) return;

    const createCheckoutSession = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/payments/quote/${quoteId}/deposit-checkout`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || data.error || 'Failed to create checkout session');
        }

        const data = await response.json();
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        } else {
          throw new Error('No checkout URL returned');
        }
      } catch (err: any) {
        setError(err.message || 'Something went wrong. Please try again.');
      }
    };

    createCheckoutSession();
  }, [quoteId]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-md p-8 max-w-md w-full text-center">
          <div className="text-red-500 mb-4">
            <svg className="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Payment Unavailable</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-md p-8 max-w-md w-full text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Preparing secure payment...</h1>
        <p className="text-gray-500 text-sm">You will be redirected to our secure payment provider shortly.</p>
      </div>
    </div>
  );
}
