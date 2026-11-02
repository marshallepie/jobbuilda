import { AuthContext, IssuePortalTokenInput } from '@jobbuilda/contracts';

export interface PortalTargetQuery {
  query<T extends Record<string, unknown>>(sql: string, values: unknown[]): Promise<{ rows: T[] }>;
}

/**
 * Establishes the immutable tenant/client/document relationship before a token
 * issuer is called. The caller never selects a tenant: context is owner-only
 * server auth, and the database must prove the requested relationship.
 */
export async function assertPortalTokenTarget(
  db: PortalTargetQuery,
  input: IssuePortalTokenInput,
  context: AuthContext,
): Promise<void> {
  const documentTable = input.purpose === 'quote_view'
    ? 'quotes'
    : input.purpose === 'invoice_payment'
      ? 'invoices'
      : 'jobs';

  const result = await db.query(
    `SELECT 1
       FROM public.clients c
       JOIN public.${documentTable} d
         ON d.client_id = c.id AND d.tenant_id = c.tenant_id
      WHERE c.id = $1 AND c.tenant_id = $2 AND d.id = $3`,
    [input.client_id, context.tenant_id, input.resource_id],
  );
  if (result.rows.length !== 1) {
    // Do not reveal whether a client, document, or tenant exists.
    throw new Error('Portal target is unavailable');
  }
}
