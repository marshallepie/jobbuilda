/**
 * Mock data for development/demo purposes
 */

export const mockLeads = [
  {
    id: 'lead-1',
    client_name: 'John Smith',
    email: 'john.smith@example.com',
    phone: '07700 900123',
    status: 'new',
    source: 'Website',
    created_at: '2024-02-10T10:30:00Z',
    notes: 'Kitchen rewire needed',
  },
  {
    id: 'lead-2',
    client_name: 'Sarah Johnson',
    email: 'sarah.j@example.com',
    phone: '07700 900456',
    status: 'contacted',
    source: 'Referral',
    created_at: '2024-02-11T14:20:00Z',
    notes: 'New build electrical installation',
  },
  {
    id: 'lead-3',
    client_name: 'David Brown',
    email: 'david.brown@example.com',
    phone: '07700 900789',
    status: 'qualified',
    source: 'Google',
    created_at: '2024-02-12T09:15:00Z',
    notes: 'Consumer unit upgrade',
  },
];

export const mockQuotes = [
  {
    id: 'quote-1',
    quote_number: 'Q-2024-001',
    title: 'Kitchen Rewire - Smith Residence',
    status: 'sent',
    total_inc_vat: '1850.00',
    valid_until: '2024-03-15T00:00:00Z',
    client_name: 'John Smith',
    created_at: '2024-02-11T10:00:00Z',
  },
  {
    id: 'quote-2',
    quote_number: 'Q-2024-002',
    title: 'Consumer Unit Upgrade - Brown Property',
    status: 'approved',
    total_inc_vat: '950.00',
    valid_until: '2024-03-20T00:00:00Z',
    client_name: 'David Brown',
    created_at: '2024-02-12T15:30:00Z',
  },
  {
    id: 'quote-3',
    quote_number: 'Q-2024-003',
    title: 'Full House Rewire - Johnson Residence',
    status: 'draft',
    total_inc_vat: '5200.00',
    valid_until: '2024-03-25T00:00:00Z',
    client_name: 'Sarah Johnson',
    created_at: '2024-02-13T11:00:00Z',
  },
];

export const mockJobs = [
  {
    id: 'job-1',
    job_number: 'J-2024-001',
    title: 'Consumer Unit Upgrade - Brown Property',
    status: 'in_progress',
    start_date: '2024-02-14T09:00:00Z',
    estimated_completion: '2024-02-14T17:00:00Z',
    client_name: 'David Brown',
  },
  {
    id: 'job-2',
    job_number: 'J-2024-002',
    title: 'Kitchen Rewire - Smith Residence',
    status: 'scheduled',
    start_date: '2024-02-16T08:00:00Z',
    estimated_completion: '2024-02-17T17:00:00Z',
    client_name: 'John Smith',
  },
  {
    id: 'job-3',
    job_number: 'J-2024-003',
    title: 'Outdoor Lighting Installation - Wilson Garden',
    status: 'completed',
    start_date: '2024-02-08T09:00:00Z',
    estimated_completion: '2024-02-09T16:00:00Z',
    actual_completion: '2024-02-09T15:30:00Z',
    client_name: 'Emma Wilson',
  },
];

export const mockInvoices = [
  {
    id: 'invoice-1',
    invoice_number: 'INV-2024-001',
    job_id: 'job-3',
    status: 'sent',
    invoice_date: '2024-02-09T17:00:00Z',
    due_date: '2024-02-23T00:00:00Z',
    payment_terms_days: 14,
    subtotal_ex_vat: '820.00',
    vat_amount: '164.00',
    total_inc_vat: '984.00',
    amount_paid: '0.00',
    amount_due: '984.00',
    notes: 'Payment due within 14 days',
    items: [
      {
        id: 'item-1',
        item_type: 'labor',
        description: 'Outdoor lighting installation',
        quantity: 8,
        unit: 'hours',
        unit_price_ex_vat: '65.00',
        line_total_ex_vat: '520.00',
        vat_rate: '0.20',
        line_vat: '104.00',
        line_total_inc_vat: '624.00',
      },
      {
        id: 'item-2',
        item_type: 'material',
        description: 'LED outdoor lights (x4)',
        quantity: 4,
        unit: 'units',
        unit_price_ex_vat: '75.00',
        line_total_ex_vat: '300.00',
        vat_rate: '0.20',
        line_vat: '60.00',
        line_total_inc_vat: '360.00',
      },
    ],
  },
];

export const mockClients = [
  {
    id: 'client-1',
    name: 'John Smith',
    email: 'john.smith@example.com',
    phone: '07700 900123',
    address: '123 Oak Street, London, SW1A 1AA',
    created_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 'client-2',
    name: 'Sarah Johnson',
    email: 'sarah.j@example.com',
    phone: '07700 900456',
    address: '456 Maple Avenue, Manchester, M1 1AA',
    created_at: '2024-01-20T14:30:00Z',
  },
  {
    id: 'client-3',
    name: 'David Brown',
    email: 'david.brown@example.com',
    phone: '07700 900789',
    address: '789 Pine Road, Birmingham, B1 1AA',
    created_at: '2024-02-01T09:15:00Z',
  },
  {
    id: 'client-4',
    name: 'Emma Wilson',
    email: 'emma.wilson@example.com',
    phone: '07700 900321',
    address: '321 Elm Close, Leeds, LS1 1AA',
    created_at: '2024-02-05T11:20:00Z',
  },
];

// Helper to simulate API delay
export const delay = (ms: number = 300) =>
  new Promise(resolve => setTimeout(resolve, ms));

// Mock API responses
export const mockApi = {
  async getLeads() {
    await delay();
    return mockLeads;
  },

  async getLead(id: string) {
    await delay();
    return mockLeads.find(l => l.id === id) || null;
  },

  async getQuotes() {
    await delay();
    return mockQuotes;
  },

  async getQuote(id: string) {
    await delay();
    return mockQuotes.find(q => q.id === id) || null;
  },

  async getJobs() {
    await delay();
    return mockJobs;
  },

  async getJob(id: string) {
    await delay();
    return mockJobs.find(j => j.id === id) || null;
  },

  async getInvoices() {
    await delay();
    return mockInvoices;
  },

  async getInvoice(id: string) {
    await delay();
    return mockInvoices.find(i => i.id === id) || null;
  },

  async getClients() {
    await delay();
    return mockClients;
  },

  async getClient(id: string) {
    await delay();
    return mockClients.find(c => c.id === id) || null;
  },
};
