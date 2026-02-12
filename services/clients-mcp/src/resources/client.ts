import { trace } from '@opentelemetry/api';
import { query } from '../lib/database.js';

export interface Client {
  id: string;
  tenant_id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
  gdpr_consent: boolean;
  gdpr_consent_date?: string;
  created_at: string;
  updated_at: string;
}

export async function getClient(clientId: string, tenantId: string): Promise<Client | null> {
  const tracer = trace.getTracer('clients-mcp');
  const span = tracer.startSpan('resource.get_client');

  try {
    span.setAttribute('client_id', clientId);
    span.setAttribute('tenant_id', tenantId);

    const result = await query<Client>(
      `SELECT id, tenant_id, name, email, phone, company, notes,
              gdpr_consent, gdpr_consent_date, created_at, updated_at
       FROM clients
       WHERE id = $1 AND tenant_id = $2`,
      [clientId, tenantId]
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

export async function listClients(tenantId: string, limit = 100, offset = 0): Promise<Client[]> {
  const tracer = trace.getTracer('clients-mcp');
  const span = tracer.startSpan('resource.list_clients');

  try {
    span.setAttribute('tenant_id', tenantId);
    span.setAttribute('limit', limit);
    span.setAttribute('offset', offset);

    const result = await query<Client>(
      `SELECT id, tenant_id, name, email, phone, company, notes,
              gdpr_consent, gdpr_consent_date, created_at, updated_at
       FROM clients
       WHERE tenant_id = $1
       ORDER BY name ASC
       LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset]
    );

    return result.rows;
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
