import { trace } from '@opentelemetry/api';
import { randomUUID } from 'crypto';
import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { AuthContext } from '@jobbuilda/contracts';

export interface CreateJobInput {
  client_id: string;
  site_id: string;
  title: string;
  description?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  assigned_to?: string;
  estimated_hours?: number;
  notes?: string;
  // Electrical work classification fields
  electrical_work_type?: 'new_circuit' | 'minor_works' | 'alteration' | 'inspection_only';
  creates_new_circuits?: boolean;
  circuit_details?: Array<{
    circuit_reference: string;
    location: string;
    description?: string;
    overcurrent_device_type: string;
    overcurrent_device_rating: string;
  }>;
}

export interface CreateJobOutput {
  id: string;
  job_number: string;
  title: string;
  status: string;
  scheduled_start?: string;
  electrical_work_type?: string;
  creates_new_circuits: boolean;
  circuit_count: number;
  created_at: string;
}

export async function createJob(
  input: CreateJobInput,
  context: AuthContext
): Promise<CreateJobOutput> {
  const tracer = trace.getTracer('jobs-mcp');
  const span = tracer.startSpan('tool.create_job');

  try {
    span.setAttribute('tenant_id', context.tenant_id);
    span.setAttribute('title', input.title);

    // Validate required fields
    if (!input.client_id) {
      throw new Error('client_id is required');
    }
    if (!input.site_id) {
      throw new Error('site_id is required');
    }
    if (!input.title) {
      throw new Error('title is required');
    }

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

    // Create job with electrical work data
    await query(
      `INSERT INTO jobs (
        id, tenant_id, job_number, client_id, site_id, title,
        description, status, scheduled_start, scheduled_end, assigned_to,
        estimated_hours, notes, electrical_work_type, creates_new_circuits,
        circuit_details, created_by, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
      [
        jobId,
        context.tenant_id,
        jobNumber,
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

    // Publish job.created event
    await publishEvent({
      type: 'job.created',
      tenant_id: context.tenant_id,
      actor: { user_id: context.user_id },
      data: {
        job_id: jobId,
        job_number: jobNumber,
        client_id: input.client_id,
        site_id: input.site_id,
        title: input.title,
        status: 'scheduled',
        electrical_work_type: input.electrical_work_type,
        creates_new_circuits: input.creates_new_circuits || false,
        circuit_count: input.circuit_details?.length || 0,
      },
      occurred_at: now,
    });

    span.setAttribute('job_id', jobId);
    span.setAttribute('job_number', jobNumber);

    return {
      id: jobId,
      job_number: jobNumber,
      title: input.title,
      status: 'scheduled',
      scheduled_start: input.scheduled_start,
      electrical_work_type: input.electrical_work_type,
      creates_new_circuits: input.creates_new_circuits || false,
      circuit_count: input.circuit_details?.length || 0,
      created_at: now,
    };
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
