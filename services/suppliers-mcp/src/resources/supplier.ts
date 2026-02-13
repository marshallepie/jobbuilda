import { trace } from '@opentelemetry/api';
import { query } from '../lib/database.js';

export interface Supplier {
  id: string;
  tenant_id: string;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  website?: string;
  account_number?: string;
  payment_terms?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function getSupplier(supplierId: string, tenantId: string): Promise<Supplier | null> {
  const tracer = trace.getTracer('suppliers-mcp');
  const span = tracer.startSpan('resource.get_supplier');

  try {
    span.setAttribute('supplier_id', supplierId);
    span.setAttribute('tenant_id', tenantId);

    const result = await query<Supplier>(
      `SELECT id, tenant_id, name, contact_name, email, phone, website,
              account_number, payment_terms, notes, is_active, created_at, updated_at
       FROM suppliers
       WHERE id = $1 AND tenant_id = $2`,
      [supplierId, tenantId]
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

export async function listSuppliers(tenantId: string, activeOnly = false): Promise<Supplier[]> {
  const tracer = trace.getTracer('suppliers-mcp');
  const span = tracer.startSpan('resource.list_suppliers');

  try {
    span.setAttribute('tenant_id', tenantId);
    span.setAttribute('active_only', activeOnly);

    const whereClause = activeOnly ? 'WHERE tenant_id = $1 AND is_active = true' : 'WHERE tenant_id = $1';

    const result = await query<Supplier>(
      `SELECT id, tenant_id, name, contact_name, email, phone, website,
              account_number, payment_terms, notes, is_active, created_at, updated_at
       FROM suppliers
       ${whereClause}
       ORDER BY name ASC`,
      [tenantId]
    );

    return result.rows;
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
