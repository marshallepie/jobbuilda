'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.session()
      .then((session) => {
        if (!session.authenticated || !session.csrfToken) throw new Error('Unable to start a secure session');
        setReady(true);
      })
      .catch(() => router.replace('/auth'));
  }, [router]);

  const logout = async () => {
    setSigningOut(true);
    setError('');
    try {
      await api.logout();
      router.replace('/auth');
    } catch {
      setError('Unable to sign out. Please try again.');
      setSigningOut(false);
    }
  };

  if (!ready) return <div className="min-h-screen flex items-center justify-center">Loading secure portal…</div>;
  return <div className="min-h-screen bg-gray-50"><nav className="bg-white shadow-sm"><div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center"><Image src="/jobbuilda_logo_full.png" alt="JobBuilda" width={130} height={44}/><button type="button" className="text-sm text-gray-700 disabled:opacity-50" disabled={signingOut} onClick={logout}>{signingOut ? 'Signing out…' : 'Sign out'}</button></div>{error && <p className="max-w-7xl mx-auto px-4 pb-3 text-sm text-red-700" role="alert">{error}</p>}</nav><main className="max-w-7xl mx-auto px-4 py-8">{children}</main></div>;
}
