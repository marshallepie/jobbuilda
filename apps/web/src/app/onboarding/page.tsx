'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import SignupStepper from '@/components/SignupStepper';
import StripeCardStep from '@/components/StripeCardStep';
import { createClient } from '@supabase/supabase-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface SignupData {
  setup_intent_client_secret: string;
  tenant_id: string;
  user_id: string;
  email: string;
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [signupData, setSignupData] = useState<SignupData | null>(null);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      // Retrieve setup data stored during registration
      const stored = sessionStorage.getItem('jobbuilda_signup');
      if (!stored) {
        setError('Session expired. Please sign up again.');
        setVerifying(false);
        return;
      }

      const data: SignupData = JSON.parse(stored);

      // Exchange the email verification token for a session
      const tokenHash = searchParams.get('token_hash');
      const type = searchParams.get('type') as 'signup' | null;

      if (tokenHash && type === 'signup') {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'signup',
        });
        if (verifyError) {
          // Token may already be consumed — check if user already has a session
          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData.session) {
            setError('Email verification link has expired. Please sign up again.');
            setVerifying(false);
            return;
          }
        }
      }

      setSignupData(data);
      setVerifying(false);
    }

    init();
  }, [searchParams]);

  function handleSuccess() {
    sessionStorage.removeItem('jobbuilda_signup');
    router.push('/welcome');
  }

  if (verifying) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-600 text-sm">Verifying your email...</p>
        </div>
      </div>
    );
  }

  if (error || !signupData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-red-600 mb-4">{error || 'Something went wrong.'}</p>
          <Link href="/signup" className="text-blue-600 hover:underline text-sm">
            Back to signup
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Link href="/" className="text-xl font-bold text-blue-600">
            JobBuilda
          </Link>
        </div>

        <SignupStepper current={2} />

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Add payment details</h1>
          <p className="text-gray-500 text-sm mb-6">
            Your 14-day free trial starts today. You won&apos;t be charged until{' '}
            <strong>
              {new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </strong>
            .
          </p>

          <Elements stripe={stripePromise}>
            <StripeCardStep
              setupIntentClientSecret={signupData.setup_intent_client_secret}
              tenantId={signupData.tenant_id}
              onSuccess={handleSuccess}
            />
          </Elements>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
