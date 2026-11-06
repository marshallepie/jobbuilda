'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { getRecoveryResource, recoveryDetailError, useRecoverySession } from '@/hooks/useRecoveryDirectRead';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';

interface InvoiceItem { id: string; description: string; quantity: number; unit?: string; unit_price_ex_vat: number; line_total_inc_vat: number; }
interface Invoice { id: string; invoice_number: string; invoice_type: string; status: string; invoice_date: string; due_date: string; subtotal_ex_vat: number; vat_amount: number; total_inc_vat: number; amount_paid?: number | string; amount_due?: number; notes?: string; items?: InvoiceItem[]; }

export default function InvoiceDetailPage() {
  const invoiceId = useParams()?.id as string;
  const { accessToken, loading: authLoading } = useRecoverySession();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (authLoading || !invoiceId) return;
    if (!accessToken) { setError('Sign in is required to load this invoice.'); setLoading(false); return; }
    let active = true;
    getRecoveryResource<Invoice>(`/api/invoices/${invoiceId}`, accessToken).then((data) => active && setInvoice(data)).catch((requestError) => active && setError(recoveryDetailError(requestError, 'invoice'))).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [accessToken, authLoading, invoiceId]);
  if (loading) return <AppLayout><div aria-label="Loading invoice" className="flex h-64 items-center justify-center"><div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary-600" /></div></AppLayout>;
  if (error) return <AppLayout><div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div></AppLayout>;
  if (!invoice) return <AppLayout><div className="py-12 text-center"><h1 className="mb-2 text-2xl font-bold">Invoice Not Found</h1><Link href="/invoices" className="text-primary-600 underline">Back to Invoices</Link></div></AppLayout>;
  return <AppLayout><main className="max-w-4xl space-y-6"><div><Link href="/invoices" className="text-sm text-primary-600 underline">← Back to Invoices</Link><div className="mt-2 flex flex-wrap items-center gap-2"><h1 className="text-3xl font-bold">Invoice {invoice.invoice_number}</h1><span className={`rounded-full px-3 py-1 text-sm ${getStatusColor(invoice.status)}`}>{invoice.status}</span></div><p className="text-gray-600">Issued {formatDate(invoice.invoice_date)} · Due {formatDate(invoice.due_date)}</p></div><section className="overflow-hidden rounded-lg bg-white shadow"><h2 className="border-b p-6 text-lg font-semibold">Invoice items</h2><ul className="divide-y">{invoice.items?.map((item) => <li key={item.id} className="flex justify-between gap-4 p-4"><span>{item.description}{item.quantity ? ` (${item.quantity}${item.unit ? ` ${item.unit}` : ''})` : ''}</span><span>{formatCurrency(item.line_total_inc_vat)}</span></li>) || <li className="p-4 text-gray-500">No item detail available.</li>}</ul><dl className="ml-auto w-72 space-y-2 p-6"><div className="flex justify-between"><dt>Subtotal</dt><dd>{formatCurrency(invoice.subtotal_ex_vat)}</dd></div><div className="flex justify-between"><dt>VAT</dt><dd>{formatCurrency(invoice.vat_amount)}</dd></div><div className="flex justify-between border-t pt-2 font-semibold"><dt>Total</dt><dd>{formatCurrency(invoice.total_inc_vat)}</dd></div>{invoice.amount_paid !== undefined && <div className="flex justify-between"><dt>Paid</dt><dd>{formatCurrency(invoice.amount_paid)}</dd></div>}{invoice.amount_due !== undefined && <div className="flex justify-between"><dt>Due</dt><dd>{formatCurrency(invoice.amount_due)}</dd></div>}</dl></section>{invoice.notes && <section className="rounded-lg bg-white p-6 shadow"><h2 className="mb-2 text-lg font-semibold">Notes</h2><p className="whitespace-pre-wrap">{invoice.notes}</p></section>}<aside className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900"><h2 className="font-semibold">Related records and actions unavailable</h2><p className="mt-1 text-sm">Client, site, job, payments, PDF, sharing, sending, editing, and deletion remain unavailable during recovery verification.</p></aside></main></AppLayout>;
}
