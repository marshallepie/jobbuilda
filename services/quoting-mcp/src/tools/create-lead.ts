import { trace } from '@opentelemetry/api';
import { randomUUID } from 'crypto';
import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { AuthContext } from '@jobbuilda/contracts';

export interface CreateLeadInput {
  client_id?: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  description?: string;
  source?: string;
  assigned_to?: string;
  notes?: string;
}

export interface CreateLeadOutput {
  lead_id: string;
  name: string;
  status: string;
  created_at: string;
}

export async function createLead(
  input: CreateLeadInput,
  context: AuthContext
): Promise<CreateLeadOutput> {
  const tracer = trace.getTracer('quoting-mcp');
  const span = tracer.startSpan('tool.create_lead');

  try {
    span.setAttribute('tenant_id', context.tenant_id);
    span.setAttribute('lead_name', input.name);

    const leadId = randomUUID();
    const now = new Date().toISOString();

    await query(
      `INSERT INTO leads (id, tenant_id, client_id, name, email, phone, address,
                          description, source, status, assigned_to, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        leadId,
        context.tenant_id,
        input.client_id || null,
        input.name,
        input.email || null,
        input.phone || null,
        input.address || null,
        input.description || null,
        input.source || null,
        'new',
        input.assigned_to || context.user_id,
        input.notes || null,
        now,
        now
      ]
    );

    // Publish event
    await publishEvent({
      id: randomUUID(),
      type: 'lead.created',
      tenant_id: context.tenant_id,
      occurred_at: now,
      actor: { user_id: context.user_id },
      data: {
        lead_id: leadId,
        name: input.name,
        email: input.email,
        phone: input.phone,
        source: input.source
      },
      schema: 'urn:jobbuilda:events:lead.created:1'
    });

    return {
      lead_id: leadId,
      name: input.name,
      status: 'new',
      created_at: now
    };
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
