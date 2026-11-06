'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { getRecoveryResource, recoveryDetailError, useRecoverySession } from '@/hooks/useRecoveryDirectRead';
import { formatDate } from '@/lib/utils';

interface Client { id: string; name: string; email?: string; phone?: string; mobile?: string; company?: string; address_line1?: string; address_line2?: string; city?: string; county?: string; postcode?: string; notes?: string; created_at?: string; updated_at?: string; }

export default function ClientDetailPage() {
  const clientId = useParams()?.id as string;
  const { accessToken, loading: authLoading } = useRecoverySession();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (authLoading || !clientId) return;
    if (!accessToken) { setError('Sign in is required to load this client.'); setLoading(false); return; }
    let active = true;
    getRecoveryResource<Client>(`/api/clients/clients/${clientId}`, accessToken).then((data) => active && setClient(data)).catch((requestError) => active && setError(recoveryDetailError(requestError, 'client'))).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [accessToken, authLoading, clientId]);
  if (loading) return <AppLayout><div aria-label="Loading client" className="flex h-64 items-center justify-center"><div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary-600" /></div></AppLayout>;
  if (error) return <AppLayout><div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div></AppLayout>;
  if (!client) return <AppLayout><div className="py-12 text-center"><h1 className="mb-2 text-2xl font-bold">Client Not Found</h1><Link href="/clients" className="text-primary-600 underline">Back to Clients</Link></div></AppLayout>;
  const address = [client.address_line1, client.address_line2, client.city, client.county, client.postcode].filter(Boolean).join(', ');
  return <AppLayout><main className="max-w-3xl space-y-6"><div><Link href="/clients" className="text-sm text-primary-600 underline">← Back to Clients</Link><h1 className="mt-2 text-3xl font-bold">{client.name}</h1>{client.company && <p className="text-gray-600">{client.company}</p>}</div><section aria-labelledby="client-details" className="rounded-lg bg-white p-6 shadow"><h2 id="client-details" className="mb-4 text-lg font-semibold">Client details</h2><dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-sm text-gray-500">Email</dt><dd>{client.email || 'Not provided'}</dd></div><div><dt className="text-sm text-gray-500">Phone</dt><dd>{client.phone || client.mobile || 'Not provided'}</dd></div>{address && <div className="sm:col-span-2"><dt className="text-sm text-gray-500">Address</dt><dd>{address}</dd></div>}{client.notes && <div className="sm:col-span-2"><dt className="text-sm text-gray-500">Notes</dt><dd>{client.notes}</dd></div>}{client.created_at && <div><dt className="text-sm text-gray-500">Client since</dt><dd>{formatDate(client.created_at)}</dd></div>}{client.updated_at && <div><dt className="text-sm text-gray-500">Last updated</dt><dd>{formatDate(client.updated_at)}</dd></div>}</dl></section><aside className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900"><h2 className="font-semibold">Related client records unavailable</h2><p className="mt-1 text-sm">Sites, jobs, quotes, exports, and edits remain unavailable during recovery verification.</p></aside></main></AppLayout>;
}
