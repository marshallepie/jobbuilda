/**
 * API Client for JobBuilda Coordinator
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface AuthContext {
  token: string;
  tenant_id: string;
  user_id: string;
  client_id?: string;
  expires_at?: number;
}

class ApiClient {
  private baseUrl: string;
  private authContext: AuthContext | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setAuth(context: AuthContext) {
    this.authContext = context;
    if (typeof window !== 'undefined') {
      localStorage.setItem('portal_auth', JSON.stringify(context));
    }
  }

  clearAuth() {
    this.authContext = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('portal_auth');
    }
  }

  loadAuth(): AuthContext | null {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('portal_auth');
      if (stored) {
        this.authContext = JSON.parse(stored);
      }
    }
    return this.authContext;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // Add auth context headers from portal token
    if (this.authContext) {
      headers['Authorization'] = `Bearer ${this.authContext.token}`;
      headers['x-tenant-id'] = this.authContext.tenant_id;
      headers['x-user-id'] = this.authContext.user_id;
      if (this.authContext.client_id) {
        headers['x-client-id'] = this.authContext.client_id;
      }
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(
        error.message || `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        error
      );
    }

    return response.json();
  }

  // Auth
  async validateToken(token: string) {
    // Decode JWT and extract claims (simple base64 decode, no verification here)
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      token,
      tenant_id: payload.tenant_id,
      user_id: payload.user_id,
      client_id: payload.client_id,
      expires_at: payload.exp,
    };
  }

  // Jobs
  async getJobs() {
    return this.request('/api/jobs');
  }

  async getJob(id: string) {
    return this.request(`/api/jobs/${id}`);
  }

  async getJobsByClient(clientId: string) {
    return this.request(`/api/jobs/client/${clientId}`);
  }

  // Quotes
  async getQuote(id: string) {
    return this.request(`/api/quotes/${id}`);
  }

  async approveQuote(id: string, notes?: string) {
    return this.request(`/api/quotes/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  }

  async rejectQuote(id: string, reason: string) {
    return this.request(`/api/quotes/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // Variations
  async getVariation(id: string) {
    return this.request(`/api/variations/${id}`);
  }

  async getJobVariations(jobId: string) {
    return this.request(`/api/variations/job/${jobId}`);
  }

  async approveVariation(id: string, notes?: string) {
    return this.request(`/api/variations/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  }

  async rejectVariation(id: string, reason: string) {
    return this.request(`/api/variations/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // Invoices
  async getInvoice(id: string) {
    return this.request(`/api/invoices/${id}`);
  }

  async getJobInvoices(jobId: string) {
    return this.request(`/api/invoices/job/${jobId}`);
  }

  // Payments
  async createCheckoutSession(invoiceId: string, amount: number) {
    return this.request('/api/payments/checkout-session', {
      method: 'POST',
      body: JSON.stringify({
        invoice_id: invoiceId,
        amount,
        currency: 'gbp',
        success_url: `${window.location.origin}/payment/success?invoice_id=${invoiceId}`,
        cancel_url: `${window.location.origin}/invoices/${invoiceId}`,
      }),
    });
  }

  async getInvoiceTransactions(invoiceId: string) {
    return this.request(`/api/payments/invoices/${invoiceId}/transactions`);
  }
}

export const api = new ApiClient(API_BASE_URL);
