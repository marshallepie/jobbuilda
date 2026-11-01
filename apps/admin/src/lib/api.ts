/**
 * API Client for JobBuilda Coordinator (Admin)
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
  /** Supabase access token; tenant context is derived server-side. */
  token: string;
}

class ApiClient {
  private baseUrl: string;
  private authContext: AuthContext | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setAuth(context: AuthContext) {
    this.authContext = { token: context.token };
  }

  clearAuth() {
    this.authContext = null;
  }

  getAccessToken(): string | null {
    return this.authContext?.token ?? null;
  }

  async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers as Record<string, string>),
    };

    // The coordinator derives tenant, user, and scopes from the verified token
    // and durable membership; do not transmit caller-selected identity headers.
    if (this.authContext?.token) {
      headers['Authorization'] = `Bearer ${this.authContext.token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (response.status === 402) {
      if (typeof window !== 'undefined') {
        window.location.href = '/subscription-required';
      }
      const error = await response.json().catch(() => ({}));
      throw new ApiError('Subscription required', 402, error);
    }

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

  // ===== LEADS =====
  async getLeads() {
    const response: any = await this.request('/api/leads');
    // Unwrap response if needed (API returns { data: [...] })
    return response.data || response;
  }

  async getLead(id: string) {
    return this.request(`/api/leads/${id}`);
  }

  async createLead(data: any) {
    return this.request('/api/leads', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLead(id: string, data: any) {
    return this.request(`/api/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async convertLeadToQuote(leadId: string) {
    return this.request(`/api/leads/${leadId}/convert`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  // ===== QUOTES =====
  async getQuotes() {
    const response: any = await this.request('/api/quotes');
    // Unwrap response if needed (API returns { data: [...] })
    return response.data || response;
  }

  async getQuote(id: string) {
    return this.request(`/api/quotes/${id}`);
  }

  async createQuote(data: any) {
    return this.request('/api/quotes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateQuote(id: string, data: any) {
    return this.request(`/api/quotes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async sendQuote(id: string) {
    return this.request(`/api/quotes/${id}/send`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async convertQuoteToJob(quoteId: string) {
    return this.request(`/api/quotes/${quoteId}/convert`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  // ===== JOBS =====
  async getJobs() {
    const response: any = await this.request('/api/jobs');
    // Unwrap response if needed (API returns { data: [...] })
    return response.data || response;
  }

  async getJob(id: string) {
    return this.request(`/api/jobs/${id}`);
  }

  async createJob(data: any) {
    return this.request('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateJob(id: string, data: any) {
    return this.request(`/api/jobs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async startJob(jobId: string) {
    return this.request(`/api/jobs/${jobId}/start`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async completeJob(jobId: string) {
    return this.request(`/api/jobs/${jobId}/complete`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  // ===== TIME TRACKING =====
  async logTime(jobId: string, data: any) {
    return this.request(`/api/jobs/${jobId}/time`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getJobTimeEntries(jobId: string) {
    const response: any = await this.request(`/api/jobs/${jobId}/time`);
    // Unwrap response if needed (API returns { data: [...] })
    return response.data || response;
  }

  // ===== MATERIALS =====
  async getMaterials() {
    const response: any = await this.request('/api/materials');
    // Unwrap response if needed (API returns { data: [...] })
    return response.data || response;
  }

  async getJobMaterials(jobId: string) {
    const response: any = await this.request(`/api/materials/job-usage/${jobId}`);
    // Unwrap response if needed (API returns { data: [...] })
    return response.data || response;
  }

  async logMaterial(data: any) {
    return this.request('/api/materials/usage', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async scanMaterial(barcode: string) {
    return this.request(`/api/materials/scan/${barcode}`);
  }

  // ===== VARIATIONS =====
  async getJobVariations(jobId: string) {
    const response: any = await this.request(`/api/variations/job/${jobId}`);
    // Unwrap response if needed (API returns { data: [...] })
    return response.data || response;
  }

  async createVariation(data: any) {
    return this.request('/api/variations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async submitVariation(id: string) {
    return this.request(`/api/variations/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  // ===== INVOICES =====
  async getInvoices() {
    const response: any = await this.request('/api/invoices');
    // Unwrap response if needed (API returns { data: [...] })
    return response.data || response;
  }

  async getInvoice(id: string) {
    return this.request(`/api/invoices/${id}`);
  }

  async createInvoice(data: any) {
    return this.request('/api/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async sendInvoice(id: string) {
    return this.request(`/api/email/invoice/${id}/send`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async importInvoices(invoices: Record<string, unknown>[]) {
    return this.request('/api/invoices/import', {
      method: 'POST',
      body: JSON.stringify({ invoices }),
    });
  }

  // ===== PAYMENTS =====
  async getPayments() {
    const response: any = await this.request('/api/payments');
    // Unwrap response if needed (API returns { data: [...] })
    return response.data || response;
  }

  async getInvoiceTransactions(invoiceId: string) {
    const response: any = await this.request(`/api/payments/invoices/${invoiceId}/transactions`);
    // Unwrap response if needed (API returns { data: [...] })
    return response.data || response;
  }

  // ===== CLIENTS =====
  async getClients() {
    const response: any = await this.request('/api/clients/clients');
    // Unwrap response if needed (API returns { data: [...] })
    return response.data || response;
  }

  async getClient(id: string) {
    return this.request(`/api/clients/clients/${id}`);
  }

  async createClient(data: any) {
    return this.request('/api/clients/clients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateClient(id: string, data: any) {
    return this.request(`/api/clients/clients/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // ===== REPORTING =====
  async getProfitLoss(startDate: string, endDate: string) {
    return this.request(`/api/reporting/profit-loss?start=${startDate}&end=${endDate}`);
  }

  async getVATReturn(startDate: string, endDate: string) {
    return this.request(`/api/reporting/vat-return?start=${startDate}&end=${endDate}`);
  }

  async getJobProfitability() {
    return this.request('/api/reporting/job-profitability');
  }
}

export const api = new ApiClient(API_BASE_URL);
