import { randomUUID } from 'crypto';
import { AuthContext } from '@jobbuilda/contracts';
import { trace } from '@opentelemetry/api';
import { query } from '../lib/database.js';
import { publish } from '../lib/event-bus.js';

export interface GDPRDeleteInput {
  client_id: string;
  confirm: boolean;
}

export interface GDPRDeleteResult {
  success: boolean;
  client_id: string;
  deleted_sites_count: number;
}

export async function gdprDelete(
  input: GDPRDeleteInput,
  context: AuthContext
): Promise<GDPRDeleteResult> {
  const tracer = trace.getTracer('clients-mcp');
  const span = tracer.startSpan('tool.gdpr_delete');

  try {
    span.setAttribute('client_id', input.client_id);
    span.setAttribute('tenant_id', context.tenant_id);

    if (!input.confirm) {
      throw new Error('GDPR deletion requires explicit confirmation');
    }

    // Count sites before deletion (for logging)
    const sitesCountResult = await query(
      `SELECT COUNT(*) as count FROM sites WHERE client_id = $1 AND tenant_id = $2`,
      [input.client_id, context.tenant_id]
    );
    const sitesCount = parseInt(sitesCountResult.rows[0].count);

    // Delete client (cascade will delete sites)
    const deleteResult = await query(
      `DELETE FROM clients WHERE id = $1 AND tenant_id = $2`,
      [input.client_id, context.tenant_id]
    );

    if (deleteResult.rowCount === 0) {
      throw new Error(`Client not found: ${input.client_id}`);
    }

    // Publish event
    await publish({
      id: randomUUID(),
      type: 'clients.gdpr_delete_completed',
      tenant_id: context.tenant_id,
      occurred_at: new Date().toISOString(),
      actor: { user_id: context.user_id },
      data: {
        client_id: input.client_id,
        deleted_sites_count: sitesCount
      },
      schema: 'urn:jobbuilda:events:clients.gdpr_delete_completed:1'
    });

    span.setAttribute('deleted_sites_count', sitesCount);

    return {
      success: true,
      client_id: input.client_id,
      deleted_sites_count: sitesCount
    };
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
