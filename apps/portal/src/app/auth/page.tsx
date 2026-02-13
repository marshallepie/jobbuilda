'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setError('No portal token provided. Please use the link from your email.');
      setLoading(false);
      return;
    }

    // Validate and store token
    api
      .validateToken(token)
      .then((context) => {
        // Check if token is expired
        if (context.expires_at && context.expires_at * 1000 < Date.now()) {
          setError('This link has expired. Please request a new one.');
          setLoading(false);
          return;
        }

        // Store auth context
        api.setAuth(context);

        // Redirect to dashboard
        router.push('/dashboard');
      })
      .catch((err) => {
        console.error('Token validation error:', err);
        setError('Invalid or expired portal link. Please request a new one.');
        setLoading(false);
      });
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            JobBuilda Client Portal
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Secure access to your jobs and invoices
          </p>
        </div>

        <div className="bg-white shadow-md rounded-lg p-6">
          {loading ? (
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <p className="mt-4 text-gray-600">Verifying your access...</p>
            </div>
          ) : error ? (
            <div className="text-center">
              <div className="text-red-600 text-sm mb-4">{error}</div>
              <p className="text-gray-600 text-sm">
                Contact your electrician to receive a new portal link.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
