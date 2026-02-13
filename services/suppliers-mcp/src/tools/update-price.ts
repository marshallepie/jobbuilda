import { trace } from '@opentelemetry/api';
import { randomUUID } from 'crypto';
import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { AuthContext } from '@jobbuilda/contracts';

export interface UpdatePriceInput {
  product_id: string;
  new_price_ex_vat: number;
  vat_rate?: number;
  reason?: string;
}

export interface UpdatePriceOutput {
  product_id: string;
  old_price_ex_vat: number;
  new_price_ex_vat: number;
  new_price_inc_vat: number;
  updated_at: string;
}

export async function updatePrice(
  input: UpdatePriceInput,
  context: AuthContext
): Promise<UpdatePriceOutput> {
  const tracer = trace.getTracer('suppliers-mcp');
  const span = tracer.startSpan('tool.update_price');

  try {
    span.setAttribute('tenant_id', context.tenant_id);
    span.setAttribute('product_id', input.product_id);
    span.setAttribute('new_price', input.new_price_ex_vat);

    // Get current product
    const currentProduct = await query(
      `SELECT id, current_price_ex_vat, current_price_inc_vat, vat_rate, supplier_id, sku, name
       FROM products
       WHERE id = $1 AND tenant_id = $2`,
      [input.product_id, context.tenant_id]
    );

    if (currentProduct.rows.length === 0) {
      throw new Error(`Product not found: ${input.product_id}`);
    }

    const product = currentProduct.rows[0];
    const oldPriceExVat = parseFloat(product.current_price_ex_vat);
    const vatRate = input.vat_rate ?? parseFloat(product.vat_rate);
    const newPriceIncVat = Math.round(input.new_price_ex_vat * (1 + vatRate / 100) * 100) / 100;
    const now = new Date().toISOString();

    // Update product price
    await query(
      `UPDATE products
       SET current_price_ex_vat = $1,
           current_price_inc_vat = $2,
           vat_rate = $3,
           last_price_update = $4,
           updated_at = $5
       WHERE id = $6 AND tenant_id = $7`,
      [input.new_price_ex_vat, newPriceIncVat, vatRate, now, now, input.product_id, context.tenant_id]
    );

    // Log to price history (trigger will also log, but we do it explicitly for reason)
    await query(
      `INSERT INTO price_history (id, tenant_id, product_id, price_ex_vat, price_inc_vat, vat_rate, changed_by, changed_at, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        randomUUID(),
        context.tenant_id,
        input.product_id,
        input.new_price_ex_vat,
        newPriceIncVat,
        vatRate,
        context.user_id,
        now,
        input.reason || null
      ]
    );

    // Publish event
    await publishEvent({
      id: randomUUID(),
      type: 'product.price_updated',
      tenant_id: context.tenant_id,
      occurred_at: now,
      actor: { user_id: context.user_id },
      data: {
        product_id: input.product_id,
        supplier_id: product.supplier_id,
        sku: product.sku,
        name: product.name,
        old_price_ex_vat: oldPriceExVat,
        new_price_ex_vat: input.new_price_ex_vat,
        new_price_inc_vat: newPriceIncVat,
        reason: input.reason
      },
      schema: 'urn:jobbuilda:events:product.price_updated:1'
    });

    return {
      product_id: input.product_id,
      old_price_ex_vat: oldPriceExVat,
      new_price_ex_vat: input.new_price_ex_vat,
      new_price_inc_vat: newPriceIncVat,
      updated_at: now
    };
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
