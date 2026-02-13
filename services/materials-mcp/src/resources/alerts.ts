import { query } from '../lib/database.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';

const tracer = trace.getTracer('materials-mcp');

export async function handleAlertsResource(
  uri: string,
  context: AuthContext
): Promise<any> {
  return tracer.startActiveSpan('resource.alerts', async (span) => {
    try {
      span.setAttributes({
        'resource.uri': uri,
        'tenant.id': context.tenant_id,
      });

      // Get active stock alerts: res://materials/alerts
      if (uri === 'res://materials/alerts') {
        const result = await query(
          `SELECT
            sa.*,
            m.sku,
            m.name,
            m.category,
            m.unit,
            m.reorder_quantity
          FROM stock_alerts sa
          JOIN materials m ON m.id = sa.material_id
          WHERE sa.tenant_id = $1 AND sa.resolved_at IS NULL
          ORDER BY sa.triggered_at DESC`,
          [context.tenant_id]
        );

        return {
          data: {
            alerts: result.rows,
            summary: {
              total_alerts: result.rows.length,
              out_of_stock: result.rows.filter(r => r.alert_type === 'out_of_stock').length,
              low_stock: result.rows.filter(r => r.alert_type === 'low_stock').length,
            },
          },
          _meta: { context },
        };
      }

      throw new Error(`Unknown alerts resource URI: ${uri}`);
    } finally {
      span.end();
    }
  });
}
