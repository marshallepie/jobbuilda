import { trace } from '@opentelemetry/api';
import { query } from '../lib/database.js';

export interface Site {
  id: string;
  tenant_id: string;
  client_id: string;
  name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  county?: string;
  postcode: string;
  country: string;
  access_notes?: string;
  created_at: string;
  updated_at: string;
}

export async function getSite(siteId: string, tenantId: string): Promise<Site | null> {
  const tracer = trace.getTracer('clients-mcp');
  const span = tracer.startSpan('resource.get_site');

  try {
    span.setAttribute('site_id', siteId);
    span.setAttribute('tenant_id', tenantId);

    const result = await query<Site>(
      `SELECT id, tenant_id, client_id, name, address_line1, address_line2,
              city, county, postcode, country, access_notes, created_at, updated_at
       FROM sites
       WHERE id = $1 AND tenant_id = $2`,
      [siteId, tenantId]
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

export async function listSitesByClient(clientId: string, tenantId: string): Promise<Site[]> {
  const tracer = trace.getTracer('clients-mcp');
  const span = tracer.startSpan('resource.list_sites_by_client');

  try {
    span.setAttribute('client_id', clientId);
    span.setAttribute('tenant_id', tenantId);

    const result = await query<Site>(
      `SELECT id, tenant_id, client_id, name, address_line1, address_line2,
              city, county, postcode, country, access_notes, created_at, updated_at
       FROM sites
       WHERE client_id = $1 AND tenant_id = $2
       ORDER BY name ASC`,
      [clientId, tenantId]
    );

    return result.rows;
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
