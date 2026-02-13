'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import ProtectedLayout from '@/components/ProtectedLayout';
import { formatCurrency } from '@/lib/utils';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

interface Invoice {
  id: string;
  invoice_number: string;
  amount_due: string;
  total_inc_vat: string;
  status: string;
}

export default function PaymentPage() {
  const params = useParams();
  const invoiceId = params.invoiceId as string;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadInvoice = async () => {
      try {
        const invoiceData = await api.getInvoice(invoiceId) as Invoice;
        setInvoice(invoiceData);

        if (invoiceData.status !== 'sent' || parseFloat(invoiceData.amount_due) <= 0) {
          setError('This invoice is not available for payment.');
        }
      } catch (err) {
        console.error('Failed to load invoice:', err);
        setError(err instanceof ApiError ? err.message : 'Failed to load invoice');
      } finally {
        setLoading(false);
      }
    };

    loadInvoice();
  }, [invoiceId]);

  const handlePayment = async () => {
    if (!invoice) return;

    setProcessing(true);
    setError(null);

    try {
      const { checkout_url } = await api.createCheckoutSession(
        invoice.id,
        parseFloat(invoice.amount_due)
      ) as { checkout_url: string };

      // Redirect to Stripe Checkout
      window.location.href = checkout_url;
    } catch (err) {
      console.error('Failed to create checkout session:', err);
      setError(err instanceof ApiError ? err.message : 'Failed to create payment session');
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <ProtectedLayout>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </ProtectedLayout>
    );
  }

  if (error || !invoice) {
    return (
      <ProtectedLayout>
        <div className="max-w-md mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-700">{error || 'Invoice not found'}</p>
            <a
              href="/dashboard"
              className="mt-4 inline-block text-primary-600 hover:text-primary-700 font-medium"
            >
              Return to Dashboard
            </a>
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="max-w-md mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Payment</h1>

          <div className="space-y-4 mb-6">
            <div className="flex justify-between">
              <span className="text-gray-600">Invoice:</span>
              <span className="font-medium text-gray-900">{invoice.invoice_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Amount:</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(invoice.total_inc_vat)}
              </span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span className="text-gray-900">Amount to Pay:</span>
              <span className="text-primary-600">
                {formatCurrency(invoice.amount_due)}
              </span>
            </div>
          </div>

          <button
            onClick={handlePayment}
            disabled={processing}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white py-3 rounded-md font-medium transition-colors"
          >
            {processing ? (
              <span className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Processing...
              </span>
            ) : (
              `Pay ${formatCurrency(invoice.amount_due)} with Stripe`
            )}
          </button>

          <p className="mt-4 text-xs text-center text-gray-500">
            Secure payment powered by Stripe. Your payment information is encrypted and secure.
          </p>
        </div>
      </div>
    </ProtectedLayout>
  );
}
