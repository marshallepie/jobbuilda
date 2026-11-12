import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

/**
 * Hook to automatically sync API client with Supabase auth
 */
export function useApi() {
  const { session } = useAuth();

  useEffect(() => {
    if (session?.access_token) {
      api.setAuth({ token: session.access_token });
    } else {
      api.clearAuth();
    }
  }, [session]);

  return api;
}
