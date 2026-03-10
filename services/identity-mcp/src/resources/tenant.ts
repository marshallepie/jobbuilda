import { Tenant } from '@jobbuilda/contracts';
import { trace } from '@opentelemetry/api';
import { query } from '../lib/database.js';

export async function getTenant(tenantId: string): Promise<Tenant | null> {
  const tracer = trace.getTracer('identity-mcp');
  const span = tracer.startSpan('resource.get_tenant');

  try {
    span.setAttribute('tenant_id', tenantId);

    // NOTE: Run on Supabase before deploying:
    // ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_account_id varchar(255);
    // ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_connect_status varchar(50);
    const result = await query<Tenant>(
      `SELECT
        id, name, plan, created_at, updated_at,
        trading_name, company_number, vat_number,
        address_line1, address_line2, city, county, postcode, country,
        phone, email, website,
        invoice_prefix, next_invoice_number, quote_prefix, next_quote_number,
        bank_name, account_name, sort_code, account_number,
        payment_terms, default_vat_rate,
        logo_url, primary_color,
        invoice_template_id, quote_template_id, template_font,
        show_payment_qr, show_item_codes, show_item_descriptions,
        footer_text, header_image_url,
        stripe_account_id, stripe_connect_status
       FROM tenants
       WHERE id = $1`,
      [tenantId]
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
