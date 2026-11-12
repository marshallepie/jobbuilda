'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, metadata?: any) => Promise<void>;
  signOut: () => Promise<void>;
  tenantId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Only use Supabase if configured, otherwise just set loading to false
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setTenantId(session?.user?.user_metadata?.tenant_id ?? null);
      if (session?.access_token) api.setAuth({ token: session.access_token });
      else api.clearAuth();
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setTenantId(session?.user?.user_metadata?.tenant_id ?? null);
      if (session?.access_token) api.setAuth({ token: session.access_token });
      else api.clearAuth();
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase authentication is not configured');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    if (data.session) {
      setSession(data.session);
      setUser(data.user);
      setTenantId(data.user?.user_metadata?.tenant_id ?? null);
      api.setAuth({ token: data.session.access_token });
      router.push('/dashboard');
    }
  };

  const signUp = async (_email: string, _password: string, _metadata?: any) => {
    // Public registration remains intentionally paused until reviewed mapping
    // provisioning exists; client metadata must never establish tenant access.
    throw new Error('Registration is temporarily unavailable');
  };

  const signOut = async () => {
    // If Supabase is configured, sign out through Supabase
    if (isSupabaseConfigured()) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }

    // Clear local state
    setSession(null);
    setUser(null);
    setTenantId(null);
    api.clearAuth();
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        tenantId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
