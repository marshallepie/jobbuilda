import { randomUUID } from 'crypto';
import { AuthContext } from '@jobbuilda/contracts';
import { trace } from '@opentelemetry/api';
import { query } from '../lib/database.js';
import { publish } from '../lib/event-bus.js';

export async function updateClient(args: any, context: AuthContext) {
  const tracer = trace.getTracer('clients-mcp');
  const span = tracer.startSpan('tool.update_client');

  try {
    const {
      client_id,
      name,
      email,
      phone,
      mobile,
      company,
      address_line1,
      address_line2,
      city,
      county,
      postcode,
      notes,
      gdpr_consent,
    } = args;

    if (!client_id) {
      throw new Error('client_id is required');
    }

    // Build update object with only provided fields
    const updates: any = { updated_at: new Date() };
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (mobile !== undefined) updates.mobile = mobile;
    if (company !== undefined) updates.company = company;
    if (address_line1 !== undefined) updates.address_line1 = address_line1;
    if (address_line2 !== undefined) updates.address_line2 = address_line2;
    if (city !== undefined) updates.city = city;
    if (county !== undefined) updates.county = county;
    if (postcode !== undefined) updates.postcode = postcode;
    if (notes !== undefined) updates.notes = notes;
    if (gdpr_consent !== undefined) updates.gdpr_consent = gdpr_consent;

    // Build SET clause
    const setFields = Object.keys(updates).map((key, i) => `${key} = $${i + 3}`);
    const values = Object.values(updates);

    const sql = `
      UPDATE clients
      SET ${setFields.join(', ')}
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `;

    const result = await query(sql, [client_id, context.tenant_id, ...values]);

    if (result.rows.length === 0) {
      throw new Error('Client not found or access denied');
    }

    const client = result.rows[0];

    span.setAttribute('client_id', client.id);
    span.setAttribute('tenant_id', context.tenant_id);

    // Publish event
    await publish({
      id: randomUUID(),
      type: 'clients.client_updated',
      tenant_id: context.tenant_id,
      occurred_at: new Date().toISOString(),
      actor: { user_id: context.user_id },
      data: {
        client_id: client.id,
        name: client.name,
      },
      schema: 'urn:jobbuilda:events:clients.client_updated:1'
    });

    return { data: client };
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
