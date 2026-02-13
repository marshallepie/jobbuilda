import { trace } from '@opentelemetry/api';
import { query } from '../lib/database.js';

export interface Product {
  id: string;
  tenant_id: string;
  supplier_id: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unit: string;
  current_price_ex_vat: number;
  current_price_inc_vat?: number;
  vat_rate: number;
  last_price_update: string;
  is_available: boolean;
  lead_time_days?: number;
  minimum_order_quantity: number;
  created_at: string;
  updated_at: string;
}

export async function getProduct(productId: string, tenantId: string): Promise<Product | null> {
  const tracer = trace.getTracer('suppliers-mcp');
  const span = tracer.startSpan('resource.get_product');

  try {
    span.setAttribute('product_id', productId);
    span.setAttribute('tenant_id', tenantId);

    const result = await query<Product>(
      `SELECT id, tenant_id, supplier_id, sku, name, description, category, unit,
              current_price_ex_vat, current_price_inc_vat, vat_rate, last_price_update,
              is_available, lead_time_days, minimum_order_quantity, created_at, updated_at
       FROM products
       WHERE id = $1 AND tenant_id = $2`,
      [productId, tenantId]
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

export async function getProductBySKU(sku: string, supplierId: string, tenantId: string): Promise<Product | null> {
  const tracer = trace.getTracer('suppliers-mcp');
  const span = tracer.startSpan('resource.get_product_by_sku');

  try {
    span.setAttribute('sku', sku);
    span.setAttribute('supplier_id', supplierId);
    span.setAttribute('tenant_id', tenantId);

    const result = await query<Product>(
      `SELECT id, tenant_id, supplier_id, sku, name, description, category, unit,
              current_price_ex_vat, current_price_inc_vat, vat_rate, last_price_update,
              is_available, lead_time_days, minimum_order_quantity, created_at, updated_at
       FROM products
       WHERE sku = $1 AND supplier_id = $2 AND tenant_id = $3`,
      [sku, supplierId, tenantId]
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

export async function listProductsBySupplier(supplierId: string, tenantId: string, availableOnly = false): Promise<Product[]> {
  const tracer = trace.getTracer('suppliers-mcp');
  const span = tracer.startSpan('resource.list_products_by_supplier');

  try {
    span.setAttribute('supplier_id', supplierId);
    span.setAttribute('tenant_id', tenantId);
    span.setAttribute('available_only', availableOnly);

    const whereClause = availableOnly
      ? 'WHERE supplier_id = $1 AND tenant_id = $2 AND is_available = true'
      : 'WHERE supplier_id = $1 AND tenant_id = $2';

    const result = await query<Product>(
      `SELECT id, tenant_id, supplier_id, sku, name, description, category, unit,
              current_price_ex_vat, current_price_inc_vat, vat_rate, last_price_update,
              is_available, lead_time_days, minimum_order_quantity, created_at, updated_at
       FROM products
       ${whereClause}
       ORDER BY name ASC`,
      [supplierId, tenantId]
    );

    return result.rows;
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}

export async function searchProducts(searchTerm: string, tenantId: string): Promise<Product[]> {
  const tracer = trace.getTracer('suppliers-mcp');
  const span = tracer.startSpan('resource.search_products');

  try {
    span.setAttribute('search_term', searchTerm);
    span.setAttribute('tenant_id', tenantId);

    const result = await query<Product>(
      `SELECT id, tenant_id, supplier_id, sku, name, description, category, unit,
              current_price_ex_vat, current_price_inc_vat, vat_rate, last_price_update,
              is_available, lead_time_days, minimum_order_quantity, created_at, updated_at
       FROM products
       WHERE tenant_id = $1
         AND (name ILIKE $2 OR sku ILIKE $2 OR description ILIKE $2)
         AND is_available = true
       ORDER BY name ASC
       LIMIT 50`,
      [tenantId, `%${searchTerm}%`]
    );

    return result.rows;
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
