const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
let csrfToken = '';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: any = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (options.method && !['GET', 'HEAD'].includes(options.method) && csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, credentials: 'include', headers });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(data.error || data.message || 'Request failed', response.status);
  }
  return response.json();
}

type PortalSession = { authenticated: boolean; csrfToken?: string };

export const api = {
  session: async () => {
    const session = await request<PortalSession>('/api/client-portal/session');
    csrfToken = session.csrfToken || '';
    return session;
  },
  exchange: async (token: string) => {
    const response: any = await request('/api/client-portal/exchange', { method: 'POST', body: JSON.stringify({ token }) });
    csrfToken = response.csrfToken || '';
    return response;
  },
  requestAccess: (email: string) => request('/api/client-portal/request-access', { method: 'POST', body: JSON.stringify({ email }) }),
  logout: () => request('/api/client-portal/logout', { method: 'POST' }),
  invoices: (search = '', status = '', dateFrom = '', dateTo = '', page = 1) => request<{ invoices: any[] }>(`/api/client-portal/invoices?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}&page=${page}`),
  invoice: (id: string) => request(`/api/client-portal/invoices/${id}`),
  getInvoice: (id: string) => request(`/api/client-portal/invoices/${id}`),
  downloadInvoice: (id: string) => `${API_BASE_URL}/api/client-portal/invoices/${encodeURIComponent(id)}/pdf`,
  getInvoiceTransactions: async (_id: string) => [],
  getJob: async (_id: string) => { throw new ApiError('Jobs are not available in the invoice portal', 403); },
  getJobVariations: async (_id: string) => { throw new ApiError('Jobs are not available in the invoice portal', 403); },
  getJobInvoices: async (_id: string) => { throw new ApiError('Jobs are not available in the invoice portal', 403); },
  createCheckoutSession: (id: string) => request<{ checkout_url: string }>(`/api/client-portal/invoices/${encodeURIComponent(id)}/checkout`, { method: 'POST' }),
};
