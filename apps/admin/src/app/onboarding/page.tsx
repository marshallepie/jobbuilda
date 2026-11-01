'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      // No session_id means someone navigated here directly — send them to signup
      router.replace('/signup');
      return;
    }

    const finish = async () => {
      const email = sessionStorage.getItem('signup_email');
      const password = sessionStorage.getItem('signup_password');

      sessionStorage.removeItem('signup_email');
      sessionStorage.removeItem('signup_password');

      if (!isSupabaseConfigured() || !email || !password) {
        // Dev mode or missing credentials — go straight to dashboard
        router.replace('/dashboard');
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setErrorMsg('Your subscription is confirmed but we couldn\'t sign you in automatically. Please log in manually.');
        setStatus('error');
        return;
      }

      router.replace('/dashboard');
    };

    finish();
  }, [router, searchParams]);

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm p-8 text-center">
          <div className="text-green-500 mb-4">
            <svg className="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Subscription confirmed!</h1>
          <p className="text-gray-600 text-sm mb-6">{errorMsg}</p>
          <a
            href="/login"
            className="inline-block py-2 px-6 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700"
          >
            Go to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4" />
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Setting up your account…</h1>
        <p className="text-gray-500 text-sm">Just a moment while we get everything ready.</p>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
