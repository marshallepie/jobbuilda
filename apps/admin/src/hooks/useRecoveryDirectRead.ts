'use client';

import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function useRecoverySession() {
  const { session, loading } = useAuth();
  return { accessToken: session?.access_token ?? null, loading };
}

/** Fetches only a caller-supplied recovery allowlist path with the real session bearer. */
export async function getRecoveryResource<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(data.message || `HTTP ${response.status}`, response.status, data);
  }
  return response.json() as Promise<T>;
}

export function recoveryDetailError(error: unknown, resource: string): string {
  if (!(error instanceof ApiError)) return `Unable to load this ${resource}. Check your connection and try again.`;
  if (error.status === 401) return 'Your session is not authenticated. Sign in again.';
  if (error.status === 403) return `You do not have access to this ${resource}.`;
  if (error.status === 404) return `${resource[0].toUpperCase()}${resource.slice(1)} not found.`;
  if (error.status === 503) return 'This area is temporarily unavailable during maintenance.';
  return `Unable to load this ${resource}. Please try again.`;
}
