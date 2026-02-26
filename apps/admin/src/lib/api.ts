/**
 * API Client for JobBuilda Coordinator (Admin)
 */

import { mockApi } from './mockData';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

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
      localStorage.setItem('admin_auth', JSON.stringify(context));
    }
  }

  clearAuth() {
    this.authContext = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_auth');
    }
  }

  loadAuth(): AuthContext | null {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('admin_auth');
      if (stored) {
        this.authContext = JSON.parse(stored);
      }
    }
    return this.authContext;
  }

  async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers as Record<string, string>),
    };

    // Add auth context headers
    if (this.authContext) {
      headers['Authorization'] = `Bearer ${this.authContext.token}`;
      headers['x-tenant-id'] = this.authContext.tenant_id;
      headers['x-user-id'] = this.authContext.user_id;
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

  // ===== LEADS =====
  async getLeads() {
    if (USE_MOCK_DATA) return mockApi.getLeads();
    const response: any = await this.request('/api/leads');
    // Unwrap response if needed (API returns { data: [...] })
    return response.data || response;
  }

  async getLead(id: string) {
    if (USE_MOCK_DATA) return mockApi.getLead(id);
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
    if (USE_MOCK_DATA) return mockApi.getQuotes();
    const response: any = await this.request('/api/quotes');
    // Unwrap response if needed (API returns { data: [...] })
    return response.data || response;
  }

  async getQuote(id: string) {
    if (USE_MOCK_DATA) return mockApi.getQuote(id);
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
    if (USE_MOCK_DATA) return mockApi.getJobs();
    const response: any = await this.request('/api/jobs');
    // Unwrap response if needed (API returns { data: [...] })
    return response.data || response;
  }

  async getJob(id: string) {
    if (USE_MOCK_DATA) return mockApi.getJob(id);
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
    if (USE_MOCK_DATA) return mockApi.getInvoices();
    const response: any = await this.request('/api/invoices');
    // Unwrap response if needed (API returns { data: [...] })
    return response.data || response;
  }

  async getInvoice(id: string) {
    if (USE_MOCK_DATA) return mockApi.getInvoice(id);
    return this.request(`/api/invoices/${id}`);
  }

  async createInvoice(data: any) {
    return this.request('/api/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async sendInvoice(id: string) {
    return this.request(`/api/invoices/${id}/send`, {
      method: 'POST',
      body: JSON.stringify({}),
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
    if (USE_MOCK_DATA) return mockApi.getClients();
    const response: any = await this.request('/api/clients/clients');
    // Unwrap response if needed (API returns { data: [...] })
    return response.data || response;
  }

  async getClient(id: string) {
    if (USE_MOCK_DATA) return mockApi.getClient(id);
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
