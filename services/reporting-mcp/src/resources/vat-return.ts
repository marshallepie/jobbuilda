import { query } from '../lib/database.js';

interface AuthContext {
  tenant_id: string;
  user_id: string;
  scopes: string[];
}

export async function handleVatReturnResource(uri: string, context?: AuthContext) {
  if (!context) {
    throw new Error('Authentication context required');
  }

  const uriPattern = /^res:\/\/reporting\/vat-returns(?:\/(.+))?$/;
  const match = uri.match(uriPattern);

  if (!match) {
    throw new Error(`Invalid URI pattern: ${uri}`);
  }

  const returnId = match[1];

  if (returnId) {
    // Get single VAT return
    const result = await query(
      `SELECT * FROM vat_returns
       WHERE id = $1 AND tenant_id = $2`,
      [returnId, context.tenant_id]
    );

    if (result.rows.length === 0) {
      throw new Error(`VAT return not found: ${returnId}`);
    }

    return result.rows[0];
  } else {
    // List all VAT returns
    const result = await query(
      `SELECT
         id,
         period_start,
         period_end,
         box5_net_vat_due,
         status,
         submitted_at,
         accepted_at,
         created_at
       FROM vat_returns
       WHERE tenant_id = $1
       ORDER BY period_start DESC`,
      [context.tenant_id]
    );

    return result.rows;
  }
}
