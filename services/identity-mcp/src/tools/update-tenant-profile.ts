import { trace } from '@opentelemetry/api';
import { query } from '../lib/database.js';
import type { AuthContext } from '@jobbuilda/contracts';

const tracer = trace.getTracer('identity-mcp');

export interface UpdateTenantProfileInput {
  // Basic info
  name?: string;
  trading_name?: string;
  company_number?: string;
  vat_number?: string;

  // Address
  address_line1?: string;
  address_line2?: string;
  city?: string;
  county?: string;
  postcode?: string;
  country?: string;

  // Contact
  phone?: string;
  email?: string;
  website?: string;

  // Invoice/Quote numbering
  invoice_prefix?: string;
  next_invoice_number?: number;
  quote_prefix?: string;
  next_quote_number?: number;

  // Banking
  bank_name?: string;
  account_name?: string;
  sort_code?: string;
  account_number?: string;

  // Payment terms
  payment_terms?: string;
  default_vat_rate?: number;

  // Branding
  logo_url?: string;
  primary_color?: string;
}

export async function updateTenantProfile(
  input: UpdateTenantProfileInput,
  context: AuthContext
): Promise<any> {
  return tracer.startActiveSpan('tool.update_tenant_profile', async (span) => {
    try {
      span.setAttributes({
        'tenant.id': context.tenant_id,
        'user.id': context.user_id,
      });

      // Build dynamic UPDATE query
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Helper to add field to update
      const addField = (field: string, value: any) => {
        if (value !== undefined) {
          updates.push(`${field} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      };

      // Add all fields
      addField('name', input.name);
      addField('trading_name', input.trading_name);
      addField('company_number', input.company_number);
      addField('vat_number', input.vat_number);
      addField('address_line1', input.address_line1);
      addField('address_line2', input.address_line2);
      addField('city', input.city);
      addField('county', input.county);
      addField('postcode', input.postcode);
      addField('country', input.country);
      addField('phone', input.phone);
      addField('email', input.email);
      addField('website', input.website);
      addField('invoice_prefix', input.invoice_prefix);
      addField('next_invoice_number', input.next_invoice_number);
      addField('quote_prefix', input.quote_prefix);
      addField('next_quote_number', input.next_quote_number);
      addField('bank_name', input.bank_name);
      addField('account_name', input.account_name);
      addField('sort_code', input.sort_code);
      addField('account_number', input.account_number);
      addField('payment_terms', input.payment_terms);
      addField('default_vat_rate', input.default_vat_rate);
      addField('logo_url', input.logo_url);
      addField('primary_color', input.primary_color);

      if (updates.length === 0) {
        throw new Error('No fields to update');
      }

      // Add tenant_id to values for WHERE clause
      values.push(context.tenant_id);

      const result = await query(
        `UPDATE tenants
         SET ${updates.join(', ')}, updated_at = NOW()
         WHERE id = $${paramIndex}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Tenant not found');
      }

      return {
        success: true,
        tenant: result.rows[0],
      };
    } catch (error) {
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}
