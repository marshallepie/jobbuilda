import { randomUUID } from 'crypto';
import { AuthContext } from '@jobbuilda/contracts';
import { trace } from '@opentelemetry/api';
import { query } from '../lib/database.js';
import { publish } from '../lib/event-bus.js';

export interface CreateClientInput {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
  gdpr_consent?: boolean;
}

export async function createClient(
  input: CreateClientInput,
  context: AuthContext
): Promise<{ id: string; name: string }> {
  const tracer = trace.getTracer('clients-mcp');
  const span = tracer.startSpan('tool.create_client');

  try {
    const clientId = randomUUID();
    const gdprConsentDate = input.gdpr_consent ? new Date().toISOString() : null;

    span.setAttribute('client_id', clientId);
    span.setAttribute('tenant_id', context.tenant_id);

    await query(
      `INSERT INTO clients (id, tenant_id, name, email, phone, company, notes, gdpr_consent, gdpr_consent_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        clientId,
        context.tenant_id,
        input.name,
        input.email || null,
        input.phone || null,
        input.company || null,
        input.notes || null,
        input.gdpr_consent || false,
        gdprConsentDate
      ]
    );

    // Publish event
    await publish({
      id: randomUUID(),
      type: 'clients.client_created',
      tenant_id: context.tenant_id,
      occurred_at: new Date().toISOString(),
      actor: { user_id: context.user_id },
      data: {
        client_id: clientId,
        name: input.name,
        email: input.email,
        company: input.company
      },
      schema: 'urn:jobbuilda:events:clients.client_created:1'
    });

    return { id: clientId, name: input.name };
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
