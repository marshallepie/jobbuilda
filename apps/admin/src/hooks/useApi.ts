import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

/** Synchronize only the Supabase access token; the server owns tenant context. */
export function useApi() {
  const { session } = useAuth();

  useEffect(() => {
    if (session?.access_token) {
      api.setAuth({ token: session.access_token });
    } else {
      api.clearAuth();
    }
  }, [session?.access_token]);

  return api;
}
