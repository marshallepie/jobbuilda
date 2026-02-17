import { randomUUID } from 'crypto';
import { AuthContext } from '@jobbuilda/contracts';
import { trace } from '@opentelemetry/api';
import { query } from '../lib/database.js';
import { publish } from '../lib/event-bus.js';

export async function updateSite(args: any, context: AuthContext) {
  const tracer = trace.getTracer('clients-mcp');
  const span = tracer.startSpan('tool.update_site');

  try {
    const {
      site_id,
      name,
      address_line1,
      address_line2,
      city,
      county,
      postcode,
      country,
      contact_name,
      contact_phone,
      access_notes,
    } = args;

    if (!site_id) {
      throw new Error('site_id is required');
    }

    // Build update object with only provided fields
    const updates: any = { updated_at: new Date() };
    if (name !== undefined) updates.name = name;
    if (address_line1 !== undefined) updates.address_line1 = address_line1;
    if (address_line2 !== undefined) updates.address_line2 = address_line2;
    if (city !== undefined) updates.city = city;
    if (county !== undefined) updates.county = county;
    if (postcode !== undefined) updates.postcode = postcode;
    if (country !== undefined) updates.country = country;
    if (contact_name !== undefined) updates.contact_name = contact_name;
    if (contact_phone !== undefined) updates.contact_phone = contact_phone;
    if (access_notes !== undefined) updates.access_notes = access_notes;

    // Build SET clause
    const setFields = Object.keys(updates).map((key, i) => `${key} = $${i + 3}`);
    const values = Object.values(updates);

    const sql = `
      UPDATE sites
      SET ${setFields.join(', ')}
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `;

    const result = await query(sql, [site_id, context.tenant_id, ...values]);

    if (result.rows.length === 0) {
      throw new Error('Site not found or access denied');
    }

    const site = result.rows[0];

    span.setAttribute('site_id', site.id);
    span.setAttribute('client_id', site.client_id);
    span.setAttribute('tenant_id', context.tenant_id);

    // Publish event
    await publish({
      id: randomUUID(),
      type: 'clients.site_updated',
      tenant_id: context.tenant_id,
      occurred_at: new Date().toISOString(),
      actor: { user_id: context.user_id },
      data: {
        site_id: site.id,
        client_id: site.client_id,
        name: site.name,
      },
      schema: 'urn:jobbuilda:events:clients.site_updated:1'
    });

    return { data: site };
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
