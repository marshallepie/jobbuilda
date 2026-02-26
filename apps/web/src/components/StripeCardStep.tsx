'use client';

import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { FormEvent, useState } from 'react';

interface StripeCardStepProps {
  setupIntentClientSecret: string;
  tenantId: string;
  onSuccess: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function StripeCardStep({
  setupIntentClientSecret,
  tenantId,
  onSuccess,
}: StripeCardStepProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    // Confirm the SetupIntent with the card
    const { error: setupError, setupIntent } = await stripe.confirmCardSetup(
      setupIntentClientSecret,
      { payment_method: { card: cardElement } }
    );

    if (setupError) {
      setError(setupError.message || 'Card setup failed');
      setLoading(false);
      return;
    }

    const paymentMethodId =
      typeof setupIntent?.payment_method === 'string'
        ? setupIntent.payment_method
        : setupIntent?.payment_method?.id;

    if (!paymentMethodId) {
      setError('Could not retrieve payment method. Please try again.');
      setLoading(false);
      return;
    }

    // Confirm subscription with API
    const res = await fetch(`${API_URL}/api/auth/confirm-subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_method_id: paymentMethodId, tenant_id: tenantId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError((err as any).error || 'Failed to activate subscription');
      setLoading(false);
      return;
    }

    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Card details</label>
        <div className="border border-gray-300 rounded-lg p-3 bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#111827',
                  '::placeholder': { color: '#9ca3af' },
                  fontFamily: 'system-ui, sans-serif',
                },
                invalid: { color: '#dc2626' },
              },
            }}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Activating trial...' : 'Start 14-day free trial'}
      </button>

      <p className="text-xs text-gray-500 text-center">
        Your card won&apos;t be charged until your 14-day trial ends. Cancel anytime before then.
      </p>
    </form>
  );
}
