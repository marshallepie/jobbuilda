'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { getRecoveryResource, recoveryDetailError, useRecoverySession } from '@/hooks/useRecoveryDirectRead';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';

interface QuoteItem { id: string; description: string; quantity: number; unit?: string; line_total_inc_vat: number; }
interface Quote { id: string; quote_number: string; title: string; description?: string; status: string; subtotal_ex_vat: number; vat_amount: number; total_inc_vat: number; valid_until?: string; terms?: string; notes?: string; created_at: string; items?: QuoteItem[]; }

export default function QuoteDetailPage() {
  const quoteId = useParams()?.id as string;
  const { accessToken, loading: authLoading } = useRecoverySession();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (authLoading || !quoteId) return;
    if (!accessToken) { setError('Sign in is required to load this quote.'); setLoading(false); return; }
    let active = true;
    getRecoveryResource<Quote>(`/api/quotes/${quoteId}`, accessToken).then((data) => active && setQuote(data)).catch((requestError) => active && setError(recoveryDetailError(requestError, 'quote'))).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [accessToken, authLoading, quoteId]);
  if (loading) return <AppLayout><div aria-label="Loading quote" className="flex h-64 items-center justify-center"><div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary-600" /></div></AppLayout>;
  if (error) return <AppLayout><div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div></AppLayout>;
  if (!quote) return <AppLayout><div className="py-12 text-center"><h1 className="mb-2 text-2xl font-bold">Quote Not Found</h1><Link href="/quotes" className="text-primary-600 underline">Back to Quotes</Link></div></AppLayout>;
  return <AppLayout><main className="max-w-4xl space-y-6"><div><Link href="/quotes" className="text-sm text-primary-600 underline">← Back to Quotes</Link><div className="mt-2 flex flex-wrap items-center gap-2"><h1 className="text-3xl font-bold">{quote.title}</h1><span className={`rounded-full px-3 py-1 text-sm ${getStatusColor(quote.status)}`}>{quote.status}</span></div><p className="text-gray-600">{quote.quote_number} · Created {formatDate(quote.created_at)}</p></div>{quote.description && <section className="rounded-lg bg-white p-6 shadow"><h2 className="mb-2 text-lg font-semibold">Description</h2><p className="whitespace-pre-wrap">{quote.description}</p></section>}<section className="overflow-hidden rounded-lg bg-white shadow"><h2 className="border-b p-6 text-lg font-semibold">Quote items</h2><ul className="divide-y">{quote.items?.map((item) => <li key={item.id} className="flex justify-between gap-4 p-4"><span>{item.description}{item.quantity ? ` (${item.quantity}${item.unit ? ` ${item.unit}` : ''})` : ''}</span><span>{formatCurrency(item.line_total_inc_vat)}</span></li>) || <li className="p-4 text-gray-500">No item detail available.</li>}</ul><dl className="ml-auto w-72 space-y-2 p-6"><div className="flex justify-between"><dt>Subtotal</dt><dd>{formatCurrency(quote.subtotal_ex_vat)}</dd></div><div className="flex justify-between"><dt>VAT</dt><dd>{formatCurrency(quote.vat_amount)}</dd></div><div className="flex justify-between border-t pt-2 font-semibold"><dt>Total</dt><dd>{formatCurrency(quote.total_inc_vat)}</dd></div></dl></section>{quote.terms && <section className="rounded-lg bg-white p-6 shadow"><h2 className="mb-2 text-lg font-semibold">Terms</h2><p className="whitespace-pre-wrap">{quote.terms}</p></section>}<aside className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900"><h2 className="font-semibold">Related records and actions unavailable</h2><p className="mt-1 text-sm">Client, site, job, invoice, preview, sharing, editing, and approval actions remain unavailable during recovery verification.</p></aside></main></AppLayout>;
}
