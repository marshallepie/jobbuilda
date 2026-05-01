'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatCurrency, formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

type ViewState = 'loading' | 'error' | 'quote' | 'invoice';

interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price_ex_vat: number;
  line_total_ex_vat: number;
  vat_rate: number;
  line_vat: number;
  line_total_inc_vat: number;
}

interface Quote {
  id: string;
  quote_number: string;
  title: string;
  status: string;
  subtotal_ex_vat: number;
  vat_amount: number;
  total_inc_vat: number;
  valid_until?: string;
  notes?: string;
  terms?: string;
  items?: QuoteItem[];
  is_digital?: boolean;
  digital_site?: string;
  engagement_type?: string;
  option_b_percent?: number;
  option_c_equity_percent?: number;
  option_b_label?: string;
  option_c_label?: string;
  engagement_selected_at?: string;
  project_urls?: Array<{ label: string; url: string }>;
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price_ex_vat: string;
  line_total_ex_vat: string;
  vat_rate: string;
  line_vat: string;
  line_total_inc_vat: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  invoice_date: string;
  due_date: string;
  subtotal_ex_vat: string;
  vat_amount: string;
  total_inc_vat: string;
  amount_due: string;
  amount_paid: string;
  notes?: string;
  items?: InvoiceItem[];
}

interface BankDetails {
  accountName: string;
  sortCode: string;
  accountNumber: string;
  bankName?: string;
}

interface Company {
  name?: string;
  companyNumber?: string;
  vatNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  county?: string;
  postcode?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
}

interface Client {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
}

function decodeToken(token: string): {
  tenant_id: string;
  user_id: string;
  purpose: string;
  resource_id: string;
  exp: number;
} | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // JWT uses base64url — convert to standard base64 before atob()
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that block clipboard without user gesture
    }
  }, [value]);

  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-sm text-gray-500">{label}</span>
      <button
        onClick={copy}
        className="flex-1 flex items-center justify-between gap-2 px-3 py-2 bg-white border-2 border-blue-200 rounded-lg text-left group hover:border-blue-400 active:scale-95 transition-all"
      >
        <span className="font-mono font-semibold text-gray-900 text-base tracking-wide">
          {value}
        </span>
        <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full transition-colors ${
          copied
            ? 'bg-green-100 text-green-700'
            : 'bg-blue-100 text-blue-600 group-hover:bg-blue-200'
        }`}>
          {copied ? 'Copied!' : 'Tap to copy'}
        </span>
      </button>
    </div>
  );
}

function ViewPageContent() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<ViewState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [authHeaders, setAuthHeaders] = useState<Record<string, string> | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [selectedEngagement, setSelectedEngagement] = useState<string | null>(null);
  const [engagementSaving, setEngagementSaving] = useState(false);
  const [engagementSaved, setEngagementSaved] = useState(false);

  const handlePayNow = useCallback(async () => {
    if (!authHeaders || !invoiceId || !invoice) return;
    setPaymentLoading(true);
    setPaymentError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/payments/checkout-session`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          invoice_id: invoiceId,
          amount: parseFloat(invoice.amount_due as any),
          currency: 'gbp',
          description: `Invoice ${invoice.invoice_number}`,
          success_url: `${window.location.origin}/payment/success?invoice_id=${invoiceId}`,
          cancel_url: window.location.href,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Could not start payment');
      }
      const data = await res.json();
      const checkoutUrl = data.checkout_url || data.checkoutUrl || data.url;
      if (!checkoutUrl) throw new Error('No checkout URL returned');
      window.location.href = checkoutUrl;
    } catch (err: any) {
      setPaymentError(err.message || 'Payment failed. Please try again.');
      setPaymentLoading(false);
    }
  }, [authHeaders, invoiceId, invoice]);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('No access token provided. Please use the link from your message.');
      setState('error');
      return;
    }

    const claims = decodeToken(token);
    if (!claims) {
      setError('Invalid link. Please use the link from your message.');
      setState('error');
      return;
    }

    if (claims.exp * 1000 < Date.now()) {
      setError('This link has expired. Please ask for a new one.');
      setState('error');
      return;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-tenant-id': claims.tenant_id,
      'x-user-id': claims.user_id,
    };
    setAuthHeaders(headers);

    const load = async () => {
      try {
        if (claims.purpose === 'quote_view') {
          const res = await fetch(
            `${API_BASE_URL}/api/quotes/${claims.resource_id}`,
            { headers }
          );
          if (!res.ok) throw new Error('Could not load quote');
          const q = await res.json();
          setQuote(q);
          setSelectedEngagement(q.engagement_type || 'option_a');
          setState('quote');
        } else if (claims.purpose === 'invoice_payment') {
          const res = await fetch(
            `${API_BASE_URL}/api/share/invoice/${claims.resource_id}/details`,
            { headers }
          );
          if (!res.ok) throw new Error('Could not load invoice');
          const { invoice: inv, bankDetails: bd, company: co, client: cl } = await res.json();
          setInvoice(inv);
          setBankDetails(bd);
          setCompany(co || null);
          setClient(cl || null);
          setInvoiceId(claims.resource_id);
          setState('invoice');
        } else {
          setError('This link type is not supported for web viewing.');
          setState('error');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load document. Please try again.');
        setState('error');
      }
    };

    load();
  }, [searchParams]);

  const handleEngagementConfirm = useCallback(async () => {
    if (!authHeaders || !quote || !selectedEngagement) return;
    setEngagementSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/quotes/${quote.id}/engagement`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ engagement_type: selectedEngagement, selected_by: 'client' }),
      });
      if (!res.ok) throw new Error('Could not save selection');
      setQuote(prev => prev ? { ...prev, engagement_type: selectedEngagement, engagement_selected_at: new Date().toISOString() } : prev);
      setEngagementSaved(true);
    } catch {
      // Non-fatal — show nothing, user can try again
    } finally {
      setEngagementSaving(false);
    }
  }, [authHeaders, quote, selectedEngagement]);

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4" />
          <p className="text-gray-600">Loading your document…</p>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-md p-8 max-w-md w-full text-center">
          <svg className="h-12 w-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Link unavailable</h2>
          <p className="text-gray-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (state === 'quote' && quote) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-1">
                  {quote.quote_number}
                </p>
                <h1 className="text-2xl font-bold text-gray-900">{quote.title}</h1>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                quote.status === 'approved' ? 'bg-green-100 text-green-800' :
                quote.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {quote.status}
              </span>
            </div>
            {quote.valid_until && (
              <p className="text-sm text-gray-500">Valid until {formatDate(quote.valid_until)}</p>
            )}
          </div>

          {quote.items && quote.items.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Items</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="pb-2 font-medium">Description</th>
                      <th className="pb-2 font-medium text-right">Qty</th>
                      <th className="pb-2 font-medium text-right">Unit price</th>
                      <th className="pb-2 font-medium text-right">Total (ex VAT)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {quote.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-3 text-gray-900">{item.description}</td>
                        <td className="py-3 text-right text-gray-600">{item.quantity} {item.unit}</td>
                        <td className="py-3 text-right text-gray-600">{formatCurrency(item.unit_price_ex_vat)}</td>
                        <td className="py-3 text-right font-medium">{formatCurrency(item.line_total_ex_vat)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
            <div className="space-y-2 max-w-xs ml-auto">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal (ex VAT)</span>
                <span>{formatCurrency(quote.subtotal_ex_vat)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>VAT</span>
                <span>{formatCurrency(quote.vat_amount)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-2">
                <span>Total</span>
                <span>{formatCurrency(quote.total_inc_vat)}</span>
              </div>
            </div>
          </div>

          {/* Engagement options — shown when B or C is configured */}
          {(quote.option_b_percent || quote.option_c_equity_percent) && (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Engagement options</h2>
              <p className="text-sm text-gray-500 mb-4">Choose how you'd like to work together. You can change this at any time before the quote is approved.</p>

              <div className="space-y-3">
                {/* Option A */}
                <button
                  onClick={() => { if (!engagementSaved) setSelectedEngagement('option_a'); }}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    selectedEngagement === 'option_a'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      selectedEngagement === 'option_a' ? 'border-green-500' : 'border-gray-300'
                    }`}>
                      {selectedEngagement === 'option_a' && <div className="w-2.5 h-2.5 rounded-full bg-green-500" />}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">Option A — Full cash payment</p>
                      <p className="text-xs text-gray-500 mt-0.5">Pay the full project fee on standard terms.</p>
                    </div>
                  </div>
                </button>

                {/* Option B — monthly retainer */}
                {quote.option_b_percent && (
                  <button
                    onClick={() => { if (!engagementSaved) setSelectedEngagement('option_b'); }}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      selectedEngagement === 'option_b'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selectedEngagement === 'option_b' ? 'border-blue-500' : 'border-gray-300'
                      }`}>
                        {selectedEngagement === 'option_b' && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">
                          Option B — Monthly retainer ({quote.option_b_percent}%/month)
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {quote.option_b_label || `Pay ${quote.option_b_percent}% of the project value per month instead of upfront.`}
                        </p>
                      </div>
                    </div>
                  </button>
                )}

                {/* Option C — equity deal */}
                {quote.option_c_equity_percent && (
                  <button
                    onClick={() => { if (!engagementSaved) setSelectedEngagement('option_c'); }}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      selectedEngagement === 'option_c'
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selectedEngagement === 'option_c' ? 'border-purple-500' : 'border-gray-300'
                      }`}>
                        {selectedEngagement === 'option_c' && <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">
                          Option C — Equity deal ({quote.option_c_equity_percent}% equity)
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {quote.option_c_label || `Give ${quote.option_c_equity_percent}% equity in exchange for a discounted project rate.`}
                        </p>
                      </div>
                    </div>
                  </button>
                )}
              </div>

              {!engagementSaved && selectedEngagement !== quote.engagement_type && (
                <button
                  onClick={handleEngagementConfirm}
                  disabled={engagementSaving}
                  className="mt-4 w-full py-3 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-60"
                >
                  {engagementSaving ? 'Saving…' : 'Confirm selection'}
                </button>
              )}

              {engagementSaved && (
                <p className="mt-4 text-center text-sm text-green-700 font-medium">
                  Selection saved. Your contractor has been notified.
                </p>
              )}
            </div>
          )}

          {/* Project URLs */}
          {quote.is_digital && quote.project_urls && quote.project_urls.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Project links</h2>
              <div className="space-y-2">
                {quote.project_urls.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-500 w-24 shrink-0">{entry.label}</span>
                    <a
                      href={entry.url.startsWith('http') ? entry.url : `https://${entry.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline truncate"
                    >
                      {entry.url}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(quote.notes || quote.terms) && (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-4 space-y-3">
              {quote.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Notes</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{quote.notes}</p>
                </div>
              )}
              {quote.terms && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Terms &amp; Conditions</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{quote.terms}</p>
                </div>
              )}
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-6">
            Powered by JobBuilda · This link expires in 7 days
          </p>
        </div>
      </div>
    );
  }

  if (state === 'invoice' && invoice) {
    const amountDue = parseFloat(invoice.amount_due as any);
    const isPaid = amountDue <= 0 || invoice.status === 'paid';

    const companyAddressParts = [
      company?.addressLine1,
      company?.addressLine2,
      company?.city,
      company?.county,
      company?.postcode,
    ].filter(Boolean);

    return (
      <div className="min-h-screen bg-gray-100 py-6 px-4">
        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { background: white !important; }
            .print-card { box-shadow: none !important; border-radius: 0 !important; }
          }
        `}</style>

        <div className="max-w-3xl mx-auto">

          {/* Action bar — hidden on print */}
          <div className="no-print flex items-center justify-between mb-4 gap-3 flex-wrap">
            {!isPaid && (
              <div className="flex-1 min-w-0">
                <div className="bg-green-600 rounded-xl p-5 text-white">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-sm font-medium opacity-80">Amount due</p>
                      <p className="text-3xl font-bold">{formatCurrency(invoice.amount_due)}</p>
                      <p className="text-sm opacity-75">Due {formatDate(invoice.due_date)}</p>
                    </div>
                    <button
                      onClick={handlePayNow}
                      disabled={paymentLoading}
                      className="shrink-0 bg-white text-green-700 font-semibold text-sm py-3 px-5 rounded-xl shadow hover:bg-green-50 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {paymentLoading ? (
                        <>
                          <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-green-700" />
                          Preparing…
                        </>
                      ) : (
                        <>💳 Pay now · Apple Pay · Google Pay · Card</>
                      )}
                    </button>
                  </div>
                  {paymentError && (
                    <p className="mt-3 text-sm bg-red-500/20 text-white rounded-lg px-3 py-2">
                      {paymentError}
                    </p>
                  )}
                </div>
              </div>
            )}
            <button
              onClick={() => window.print()}
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
            >
              🖨️ Print / Save PDF
            </button>
          </div>

          {/* The invoice document itself */}
          <div className="bg-white rounded-xl shadow-sm print-card">

            {/* Invoice header */}
            <div className="p-8 border-b border-gray-100">
              <div className="flex items-start justify-between gap-6">
                {/* From: company */}
                <div className="flex-1 min-w-0">
                  {company?.logoUrl ? (
                    <img
                      src={company.logoUrl}
                      alt={company.name || 'Company logo'}
                      className="h-14 w-auto object-contain mb-3"
                    />
                  ) : company?.name ? (
                    <p className="text-xl font-bold text-gray-900 mb-1">{company.name}</p>
                  ) : null}
                  {companyAddressParts.length > 0 && (
                    <p className="text-sm text-gray-500 leading-relaxed">
                      {companyAddressParts.join(', ')}
                    </p>
                  )}
                  {company?.phone && (
                    <p className="text-sm text-gray-500 mt-0.5">{company.phone}</p>
                  )}
                  {company?.email && (
                    <p className="text-sm text-gray-500 mt-0.5">{company.email}</p>
                  )}
                  {company?.vatNumber && (
                    <p className="text-xs text-gray-400 mt-1">VAT No: {company.vatNumber}</p>
                  )}
                  {company?.companyNumber && (
                    <p className="text-xs text-gray-400">Co. No: {company.companyNumber}</p>
                  )}
                </div>

                {/* Invoice title + meta */}
                <div className="text-right shrink-0">
                  <h1 className="text-3xl font-bold text-gray-900 tracking-tight">INVOICE</h1>
                  <p className="text-sm font-semibold text-green-600 mt-1">{invoice.invoice_number}</p>
                  <div className="mt-3 space-y-1 text-sm text-gray-600">
                    <div className="flex justify-end gap-4">
                      <span className="text-gray-400">Date</span>
                      <span>{formatDate(invoice.invoice_date)}</span>
                    </div>
                    <div className="flex justify-end gap-4">
                      <span className="text-gray-400">Due</span>
                      <span className={invoice.status === 'overdue' ? 'text-red-600 font-semibold' : ''}>
                        {formatDate(invoice.due_date)}
                      </span>
                    </div>
                  </div>
                  <span className={`inline-block mt-3 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                    isPaid ? 'bg-green-100 text-green-800' :
                    invoice.status === 'overdue' ? 'bg-red-100 text-red-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {isPaid ? 'Paid' : invoice.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Bill to */}
            {client && (
              <div className="px-8 pt-6 pb-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Bill to</p>
                <p className="text-base font-semibold text-gray-900">{client.name}</p>
                {client.company && <p className="text-sm text-gray-600">{client.company}</p>}
                {client.email && <p className="text-sm text-gray-500">{client.email}</p>}
                {client.phone && <p className="text-sm text-gray-500">{client.phone}</p>}
              </div>
            )}

            {/* Line items */}
            {invoice.items && invoice.items.length > 0 && (
              <div className="px-8 py-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                      <th className="text-left pb-3 font-semibold">Description</th>
                      <th className="text-right pb-3 font-semibold w-32">Total (ex VAT)</th>
                      <th className="text-right pb-3 font-semibold w-32">Total (inc VAT)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item, i) => (
                      <tr key={item.id} className={i % 2 === 0 ? 'bg-gray-50/50' : ''}>
                        <td className="py-3 pr-4 text-gray-900 leading-snug">{item.description}</td>
                        <td className="py-3 text-right text-gray-600 tabular-nums">
                          {formatCurrency(item.line_total_ex_vat)}
                        </td>
                        <td className="py-3 text-right font-medium text-gray-900 tabular-nums">
                          {formatCurrency(item.line_total_inc_vat)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals */}
                <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Subtotal (ex VAT)</span>
                      <span className="tabular-nums">{formatCurrency(invoice.subtotal_ex_vat)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>VAT</span>
                      <span className="tabular-nums">{formatCurrency(invoice.vat_amount)}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-2">
                      <span>Total</span>
                      <span className="tabular-nums">{formatCurrency(invoice.total_inc_vat)}</span>
                    </div>
                    {parseFloat(invoice.amount_paid as any) > 0 && (
                      <div className="flex justify-between text-sm text-green-700">
                        <span>Amount paid</span>
                        <span className="tabular-nums">−{formatCurrency(invoice.amount_paid)}</span>
                      </div>
                    )}
                    {!isPaid && (
                      <div className="flex justify-between text-base font-bold text-red-700 border-t border-gray-200 pt-2">
                        <span>Balance due</span>
                        <span className="tabular-nums">{formatCurrency(invoice.amount_due)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            {invoice.notes && (
              <div className="px-8 py-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Notes</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{invoice.notes}</p>
              </div>
            )}

            {/* Bank details — visible in document and on print */}
            {bankDetails && !isPaid && (
              <div className="px-8 py-6 border-t border-gray-100 bg-gray-50 rounded-b-xl">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Payment by bank transfer
                </p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                  <span className="text-gray-500">Account name</span>
                  <span className="font-medium text-gray-900">{bankDetails.accountName}</span>
                  <span className="text-gray-500">Sort code</span>
                  <span className="font-medium text-gray-900 font-mono">{bankDetails.sortCode}</span>
                  <span className="text-gray-500">Account number</span>
                  <span className="font-medium text-gray-900 font-mono">{bankDetails.accountNumber}</span>
                  <span className="text-gray-500">Reference</span>
                  <span className="font-medium text-gray-900">{invoice.invoice_number}</span>
                </div>
              </div>
            )}
          </div>

          {/* Tap-to-copy bank fields — screen only */}
          {bankDetails && !isPaid && (
            <div className="no-print bg-white rounded-xl shadow-sm p-6 mt-4">
              <h2 className="text-base font-semibold text-gray-900 mb-1">Tap to copy bank details</h2>
              <p className="text-xs text-gray-500 mb-4">
                Tap any field to copy it into your banking app.
              </p>
              <div className="space-y-3">
                <CopyField label="Account name" value={bankDetails.accountName} />
                <CopyField label="Sort code"    value={bankDetails.sortCode} />
                <CopyField label="Account no"   value={bankDetails.accountNumber} />
                <CopyField label="Reference"    value={invoice.invoice_number} />
              </div>
            </div>
          )}

          <p className="no-print text-center text-xs text-gray-400 mt-6">
            Powered by JobBuilda
          </p>
        </div>
      </div>
    );
  }

  return null;
}

export default function ViewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4" />
            <p className="text-gray-600">Loading your document…</p>
          </div>
        </div>
      }
    >
      <ViewPageContent />
    </Suspense>
  );
}
