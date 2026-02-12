import { randomUUID } from 'crypto';
import { AuthContext } from '@jobbuilda/contracts';
import { trace } from '@opentelemetry/api';
import { query } from '../lib/database.js';
import { publish } from '../lib/event-bus.js';

export interface GDPRExportInput {
  client_id: string;
}

export interface GDPRExportResult {
  export_id: string;
  status: string;
  data: {
    client: any;
    sites: any[];
  };
}

export async function gdprExport(
  input: GDPRExportInput,
  context: AuthContext
): Promise<GDPRExportResult> {
  const tracer = trace.getTracer('clients-mcp');
  const span = tracer.startSpan('tool.gdpr_export');

  try {
    const exportId = randomUUID();

    span.setAttribute('export_id', exportId);
    span.setAttribute('client_id', input.client_id);
    span.setAttribute('tenant_id', context.tenant_id);

    // Fetch client data
    const clientResult = await query(
      `SELECT * FROM clients WHERE id = $1 AND tenant_id = $2`,
      [input.client_id, context.tenant_id]
    );

    if (clientResult.rows.length === 0) {
      throw new Error(`Client not found: ${input.client_id}`);
    }

    // Fetch all sites for this client
    const sitesResult = await query(
      `SELECT * FROM sites WHERE client_id = $1 AND tenant_id = $2`,
      [input.client_id, context.tenant_id]
    );

    const exportData = {
      client: clientResult.rows[0],
      sites: sitesResult.rows
    };

    // Log the export request
    await query(
      `INSERT INTO gdpr_exports (id, tenant_id, client_id, requested_by, completed_at, export_data, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        exportId,
        context.tenant_id,
        input.client_id,
        context.user_id,
        new Date().toISOString(),
        JSON.stringify(exportData),
        'completed'
      ]
    );

    // Publish event
    await publish({
      id: randomUUID(),
      type: 'clients.gdpr_export_completed',
      tenant_id: context.tenant_id,
      occurred_at: new Date().toISOString(),
      actor: { user_id: context.user_id },
      data: {
        export_id: exportId,
        client_id: input.client_id
      },
      schema: 'urn:jobbuilda:events:clients.gdpr_export_completed:1'
    });

    return {
      export_id: exportId,
      status: 'completed',
      data: exportData
    };
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
