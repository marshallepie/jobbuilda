import { trace } from '@opentelemetry/api';
import { randomUUID } from 'crypto';
import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { AuthContext } from '@jobbuilda/contracts';

export interface CreateJobFromQuoteInput {
  quote_id: string;
  client_id: string;
  site_id: string;
  title: string;
  description?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  assigned_to?: string;
  estimated_hours?: number;
  notes?: string;
  quote_items?: Array<{
    quote_item_id?: string;
    item_type: 'material' | 'labor' | 'other';
    description: string;
    quantity_planned: number;
    unit?: string;
  }>;
  // Electrical work classification fields
  electrical_work_type?: 'new_circuit' | 'minor_works' | 'alteration' | 'inspection_only';
  creates_new_circuits?: boolean;
  circuit_details?: Array<{
    circuit_reference: string;
    location: string;
    overcurrent_device_type: string;
    overcurrent_device_rating: string;
  }>;
}

export interface CreateJobFromQuoteOutput {
  job_id: string;
  job_number: string;
  title: string;
  status: string;
  scheduled_start?: string;
  item_count: number;
  created_at: string;
}

export async function createJobFromQuote(
  input: CreateJobFromQuoteInput,
  context: AuthContext
): Promise<CreateJobFromQuoteOutput> {
  const tracer = trace.getTracer('jobs-mcp');
  const span = tracer.startSpan('tool.create_job_from_quote');

  try {
    span.setAttribute('tenant_id', context.tenant_id);
    span.setAttribute('quote_id', input.quote_id);

    const jobId = randomUUID();
    const now = new Date().toISOString();

    // Generate job number (format: J-YYYYMMDD-XXX)
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const countResult = await query(
      `SELECT COUNT(*) as count FROM jobs WHERE tenant_id = $1 AND job_number LIKE $2`,
      [context.tenant_id, `J-${dateStr}-%`]
    );
    const count = parseInt(countResult.rows[0].count) + 1;
    const jobNumber = `J-${dateStr}-${count.toString().padStart(3, '0')}`;

    // Create job
    await query(
      `INSERT INTO jobs (id, tenant_id, job_number, quote_id, client_id, site_id, title,
                         description, status, scheduled_start, scheduled_end, assigned_to,
                         estimated_hours, notes, electrical_work_type, creates_new_circuits,
                         circuit_details, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
      [
        jobId,
        context.tenant_id,
        jobNumber,
        input.quote_id,
        input.client_id,
        input.site_id,
        input.title,
        input.description || null,
        'scheduled',
        input.scheduled_start || null,
        input.scheduled_end || null,
        input.assigned_to || context.user_id,
        input.estimated_hours || null,
        input.notes || null,
        input.electrical_work_type || null,
        input.creates_new_circuits || false,
        input.circuit_details ? JSON.stringify(input.circuit_details) : null,
        context.user_id,
        now,
        now
      ]
    );

    // Add job items from quote items
    let itemCount = 0;
    if (input.quote_items && input.quote_items.length > 0) {
      for (const item of input.quote_items) {
        const itemId = randomUUID();
        await query(
          `INSERT INTO job_items (id, tenant_id, job_id, quote_item_id, item_type, description,
                                  quantity_planned, quantity_used, unit, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            itemId,
            context.tenant_id,
            jobId,
            item.quote_item_id || null,
            item.item_type,
            item.description,
            item.quantity_planned,
            0,
            item.unit || 'unit',
            'pending',
            now,
            now
          ]
        );
        itemCount++;
      }
    }

    // Auto-create test record if electrical work is specified
    // This enables automatic certificate generation workflow
    if (input.electrical_work_type) {
      // Note: Test creation is handled by tests-mcp service via event subscription
      // or can be called directly via MCP tool in coordinator
      span.addEvent('electrical_work_detected', {
        electrical_work_type: input.electrical_work_type,
        creates_new_circuits: input.creates_new_circuits || false
      });
    }

    // Publish event
    await publishEvent({
      id: randomUUID(),
      type: 'job.created',
      tenant_id: context.tenant_id,
      occurred_at: now,
      actor: { user_id: context.user_id },
      data: {
        job_id: jobId,
        job_number: jobNumber,
        quote_id: input.quote_id,
        client_id: input.client_id,
        site_id: input.site_id,
        title: input.title,
        scheduled_start: input.scheduled_start,
        item_count: itemCount,
        electrical_work_type: input.electrical_work_type,
        creates_new_circuits: input.creates_new_circuits,
        circuit_count: input.circuit_details?.length || 0
      },
      schema: 'urn:jobbuilda:events:job.created:1'
    });

    return {
      job_id: jobId,
      job_number: jobNumber,
      title: input.title,
      status: 'scheduled',
      scheduled_start: input.scheduled_start,
      item_count: itemCount,
      created_at: now
    };
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
