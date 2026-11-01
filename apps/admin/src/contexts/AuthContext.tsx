'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
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
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setTenantId(session?.user?.user_metadata?.tenant_id ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    // Development mode: if Supabase not configured, use mock auth
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured - using development mode');
      // Create mock session
      const mockUser: any = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        email,
        user_metadata: {
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
          role: 'admin',
        },
      };
      const mockSession: any = {
        access_token: 'mock-jwt-token',
        user: mockUser,
      };
      setSession(mockSession);
      setUser(mockUser);
      setTenantId(mockUser.user_metadata.tenant_id);
      router.push('/dashboard');
      return;
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
      router.push('/dashboard');
    }
  };

  const signUp = async (email: string, password: string, metadata?: any) => {
    // Development mode: if Supabase not configured, use mock auth
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured - using development mode');
      // Create mock session with provided metadata
      const mockUser: any = {
        id: crypto.randomUUID(),
        email,
        user_metadata: {
          ...metadata,
          tenant_id: metadata?.tenant_id || crypto.randomUUID(),
          role: metadata?.role || 'admin',
        },
      };
      const mockSession: any = {
        access_token: 'mock-jwt-token',
        user: mockUser,
      };
      setSession(mockSession);
      setUser(mockUser);
      setTenantId(mockUser.user_metadata.tenant_id);
      router.push('/dashboard');
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });

    if (error) throw error;

    if (data.session) {
      setSession(data.session);
      setUser(data.user);
      setTenantId(data.user?.user_metadata?.tenant_id ?? null);
      router.push('/dashboard');
    }
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
