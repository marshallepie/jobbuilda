import { trace } from '@opentelemetry/api';
import { randomUUID } from 'crypto';
import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { AuthContext } from '@jobbuilda/contracts';

export interface CreateSupplierInput {
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  website?: string;
  account_number?: string;
  payment_terms?: string;
  notes?: string;
  is_active?: boolean;
}

export interface CreateSupplierOutput {
  supplier_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export async function createSupplier(
  input: CreateSupplierInput,
  context: AuthContext
): Promise<CreateSupplierOutput> {
  const tracer = trace.getTracer('suppliers-mcp');
  const span = tracer.startSpan('tool.create_supplier');

  try {
    span.setAttribute('tenant_id', context.tenant_id);
    span.setAttribute('supplier_name', input.name);

    const supplierId = randomUUID();
    const now = new Date().toISOString();

    await query(
      `INSERT INTO suppliers (id, tenant_id, name, contact_name, email, phone, website,
                              account_number, payment_terms, notes, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        supplierId,
        context.tenant_id,
        input.name,
        input.contact_name || null,
        input.email || null,
        input.phone || null,
        input.website || null,
        input.account_number || null,
        input.payment_terms || null,
        input.notes || null,
        input.is_active ?? true,
        now,
        now
      ]
    );

    // Publish event
    await publishEvent({
      id: randomUUID(),
      type: 'supplier.created',
      tenant_id: context.tenant_id,
      occurred_at: now,
      actor: { user_id: context.user_id },
      data: {
        supplier_id: supplierId,
        name: input.name,
        is_active: input.is_active ?? true
      },
      schema: 'urn:jobbuilda:events:supplier.created:1'
    });

    return {
      supplier_id: supplierId,
      name: input.name,
      is_active: input.is_active ?? true,
      created_at: now
    };
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
