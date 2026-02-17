import { randomUUID } from 'crypto';
import { AuthContext } from '@jobbuilda/contracts';
import { trace } from '@opentelemetry/api';
import { query } from '../lib/database.js';
import { publish } from '../lib/event-bus.js';

export async function deleteSite(args: any, context: AuthContext) {
  const tracer = trace.getTracer('clients-mcp');
  const span = tracer.startSpan('tool.delete_site');

  try {
    const { site_id } = args;

    if (!site_id) {
      throw new Error('site_id is required');
    }

    // First, get the site details before deletion
    const siteQuery = `
      SELECT * FROM sites
      WHERE id = $1 AND tenant_id = $2
    `;
    const siteResult = await query(siteQuery, [site_id, context.tenant_id]);

    if (siteResult.rows.length === 0) {
      throw new Error('Site not found or access denied');
    }

    const site = siteResult.rows[0];

    span.setAttribute('site_id', site.id);
    span.setAttribute('client_id', site.client_id);
    span.setAttribute('tenant_id', context.tenant_id);

    // Delete the site
    const deleteQuery = `
      DELETE FROM sites
      WHERE id = $1 AND tenant_id = $2
    `;
    await query(deleteQuery, [site_id, context.tenant_id]);

    // Publish event
    await publish({
      id: randomUUID(),
      type: 'clients.site_deleted',
      tenant_id: context.tenant_id,
      occurred_at: new Date().toISOString(),
      actor: { user_id: context.user_id },
      data: {
        site_id: site.id,
        client_id: site.client_id,
        name: site.name,
      },
      schema: 'urn:jobbuilda:events:clients.site_deleted:1'
    });

    return {
      success: true,
      message: 'Site deleted successfully',
    };
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
