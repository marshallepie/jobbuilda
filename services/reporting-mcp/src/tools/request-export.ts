import { randomUUID } from 'crypto';
import { query } from '../lib/database.js';
import { publish } from '../lib/event-bus.js';

interface AuthContext {
  tenant_id: string;
  user_id: string;
  scopes: string[];
}

interface RequestExportInput {
  export_type: string;
  format: 'pdf' | 'csv' | 'xlsx';
  period_start?: string;
  period_end?: string;
  filters?: Record<string, any>;
}

export async function requestExport(input: RequestExportInput, context: AuthContext) {
  const { export_type, format, period_start, period_end, filters } = input;

  // Create export request
  const exportId = randomUUID();
  const result = await query(
    `INSERT INTO export_requests (
       id, tenant_id, export_type, format, period_start, period_end, filters, requested_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      exportId,
      context.tenant_id,
      export_type,
      format,
      period_start || null,
      period_end || null,
      filters ? JSON.stringify(filters) : null,
      context.user_id,
    ]
  );

  const exportRequest = result.rows[0];

  // Publish event for async processing
  await publish({
    id: randomUUID(),
    type: 'reporting.export_requested',
    tenant_id: context.tenant_id,
    occurred_at: new Date().toISOString(),
    actor: { user_id: context.user_id },
    data: {
      export_id: exportId,
      export_type,
      format,
      period_start,
      period_end,
    },
    schema: 'urn:jobbuilda:events:reporting.export_requested:1',
  });

  return {
    success: true,
    export_request: exportRequest,
    message: 'Export request created. Processing will begin shortly.',
  };
}
