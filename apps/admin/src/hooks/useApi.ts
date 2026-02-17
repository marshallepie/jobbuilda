import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

/**
 * Hook to automatically sync API client with Supabase auth
 */
export function useApi() {
  const { session, user, tenantId } = useAuth();

  useEffect(() => {
    if (session && user && tenantId) {
      // Set auth context for API client
      api.setAuth({
        token: session.access_token,
        tenant_id: tenantId,
        user_id: user.id,
      });
    } else {
      api.clearAuth();
    }
  }, [session, user, tenantId]);

  return api;
}
