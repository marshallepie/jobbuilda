import { trace } from '@opentelemetry/api';
import { query } from '../lib/database.js';

export interface Lead {
  id: string;
  tenant_id: string;
  client_id?: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  description?: string;
  source?: string;
  status: string;
  assigned_to?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export async function getLead(leadId: string, tenantId: string): Promise<Lead | null> {
  const tracer = trace.getTracer('quoting-mcp');
  const span = tracer.startSpan('resource.get_lead');

  try {
    span.setAttribute('lead_id', leadId);
    span.setAttribute('tenant_id', tenantId);

    const result = await query<Lead>(
      `SELECT id, tenant_id, client_id, name, email, phone, address, description,
              source, status, assigned_to, notes, created_at, updated_at
       FROM leads
       WHERE id = $1 AND tenant_id = $2`,
      [leadId, tenantId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}

export async function listLeads(tenantId: string, status?: string): Promise<Lead[]> {
  const tracer = trace.getTracer('quoting-mcp');
  const span = tracer.startSpan('resource.list_leads');

  try {
    span.setAttribute('tenant_id', tenantId);
    if (status) {
      span.setAttribute('status', status);
    }

    const whereClause = status
      ? 'WHERE tenant_id = $1 AND status = $2'
      : 'WHERE tenant_id = $1';
    const params = status ? [tenantId, status] : [tenantId];

    const result = await query<Lead>(
      `SELECT id, tenant_id, client_id, name, email, phone, address, description,
              source, status, assigned_to, notes, created_at, updated_at
       FROM leads
       ${whereClause}
       ORDER BY created_at DESC`,
      params
    );

    return result.rows;
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
