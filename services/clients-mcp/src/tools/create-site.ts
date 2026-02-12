import { randomUUID } from 'crypto';
import { AuthContext } from '@jobbuilda/contracts';
import { trace } from '@opentelemetry/api';
import { query } from '../lib/database.js';
import { publish } from '../lib/event-bus.js';

export interface CreateSiteInput {
  client_id: string;
  name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  county?: string;
  postcode: string;
  country?: string;
  access_notes?: string;
}

export async function createSite(
  input: CreateSiteInput,
  context: AuthContext
): Promise<{ id: string; name: string }> {
  const tracer = trace.getTracer('clients-mcp');
  const span = tracer.startSpan('tool.create_site');

  try {
    const siteId = randomUUID();

    span.setAttribute('site_id', siteId);
    span.setAttribute('client_id', input.client_id);
    span.setAttribute('tenant_id', context.tenant_id);

    await query(
      `INSERT INTO sites (id, tenant_id, client_id, name, address_line1, address_line2,
                          city, county, postcode, country, access_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        siteId,
        context.tenant_id,
        input.client_id,
        input.name,
        input.address_line1,
        input.address_line2 || null,
        input.city,
        input.county || null,
        input.postcode,
        input.country || 'United Kingdom',
        input.access_notes || null
      ]
    );

    // Publish event
    await publish({
      id: randomUUID(),
      type: 'clients.site_created',
      tenant_id: context.tenant_id,
      occurred_at: new Date().toISOString(),
      actor: { user_id: context.user_id },
      data: {
        site_id: siteId,
        client_id: input.client_id,
        name: input.name,
        postcode: input.postcode
      },
      schema: 'urn:jobbuilda:events:clients.site_created:1'
    });

    return { id: siteId, name: input.name };
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
