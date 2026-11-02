import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';

/**
 * Makes recovery-scope requests only after Supabase has resolved the persisted
 * session and keeps the API bearer token synchronized when it becomes available.
 */
export function useRecoveryApi() {
  const { session, loading: authLoading } = useAuth();
  const accessToken = session?.access_token;

  useEffect(() => {
    if (accessToken) {
      api.setAuth({ token: accessToken });
    } else {
      api.clearAuth();
    }
  }, [accessToken]);

  return {
    api,
    authLoading,
    hasSession: Boolean(accessToken),
    accessToken,
  };
}

export function recoveryErrorMessage(error: unknown, resource: string): string {
  if (!(error instanceof ApiError)) {
    return `Unable to load ${resource}. Check your connection and try again.`;
  }
  if (error.status === 401) return 'Your session is not authenticated. Sign in again.';
  if (error.status === 403) return `You do not have access to ${resource}.`;
  if (error.status === 503 && error.data?.code === 'ACCOUNT_ACCESS_PAUSED') {
    return 'Maintenance containment is active for this area.';
  }
  if (error.status === 503) return 'The service is temporarily unavailable. Please try again shortly.';
  return `Unable to load ${resource}. Please try again.`;
}
