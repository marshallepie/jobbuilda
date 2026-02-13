import { trace } from '@opentelemetry/api';
import { randomUUID } from 'crypto';
import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { AuthContext } from '@jobbuilda/contracts';

export interface CreateProductInput {
  supplier_id: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unit?: string;
  price_ex_vat: number;
  vat_rate?: number;
  is_available?: boolean;
  lead_time_days?: number;
  minimum_order_quantity?: number;
}

export interface CreateProductOutput {
  product_id: string;
  supplier_id: string;
  sku: string;
  name: string;
  price_ex_vat: number;
  price_inc_vat: number;
  created_at: string;
}

export async function createProduct(
  input: CreateProductInput,
  context: AuthContext
): Promise<CreateProductOutput> {
  const tracer = trace.getTracer('suppliers-mcp');
  const span = tracer.startSpan('tool.create_product');

  try {
    span.setAttribute('tenant_id', context.tenant_id);
    span.setAttribute('supplier_id', input.supplier_id);
    span.setAttribute('sku', input.sku);

    // Verify supplier exists and belongs to tenant
    const supplierCheck = await query(
      'SELECT id FROM suppliers WHERE id = $1 AND tenant_id = $2',
      [input.supplier_id, context.tenant_id]
    );

    if (supplierCheck.rows.length === 0) {
      throw new Error(`Supplier not found: ${input.supplier_id}`);
    }

    const productId = randomUUID();
    const now = new Date().toISOString();
    const vatRate = input.vat_rate ?? 20.0;
    const priceIncVat = Math.round(input.price_ex_vat * (1 + vatRate / 100) * 100) / 100;

    await query(
      `INSERT INTO products (id, tenant_id, supplier_id, sku, name, description, category, unit,
                             current_price_ex_vat, current_price_inc_vat, vat_rate, last_price_update,
                             is_available, lead_time_days, minimum_order_quantity, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        productId,
        context.tenant_id,
        input.supplier_id,
        input.sku,
        input.name,
        input.description || null,
        input.category || null,
        input.unit || 'unit',
        input.price_ex_vat,
        priceIncVat,
        vatRate,
        now,
        input.is_available ?? true,
        input.lead_time_days || null,
        input.minimum_order_quantity || 1,
        now,
        now
      ]
    );

    // Publish event
    await publishEvent({
      id: randomUUID(),
      type: 'product.created',
      tenant_id: context.tenant_id,
      occurred_at: now,
      actor: { user_id: context.user_id },
      data: {
        product_id: productId,
        supplier_id: input.supplier_id,
        sku: input.sku,
        name: input.name,
        price_ex_vat: input.price_ex_vat,
        price_inc_vat: priceIncVat
      },
      schema: 'urn:jobbuilda:events:product.created:1'
    });

    return {
      product_id: productId,
      supplier_id: input.supplier_id,
      sku: input.sku,
      name: input.name,
      price_ex_vat: input.price_ex_vat,
      price_inc_vat: priceIncVat,
      created_at: now
    };
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
