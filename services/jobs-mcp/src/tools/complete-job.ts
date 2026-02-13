import { trace } from '@opentelemetry/api';
import { randomUUID } from 'crypto';
import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { AuthContext } from '@jobbuilda/contracts';

export interface CompleteJobInput {
  job_id: string;
  notes?: string;
}

export interface CompleteJobOutput {
  job_id: string;
  job_number: string;
  status: string;
  actual_start: string;
  actual_end: string;
  actual_hours: number;
}

export async function completeJob(
  input: CompleteJobInput,
  context: AuthContext
): Promise<CompleteJobOutput> {
  const tracer = trace.getTracer('jobs-mcp');
  const span = tracer.startSpan('tool.complete_job');

  try {
    span.setAttribute('tenant_id', context.tenant_id);
    span.setAttribute('job_id', input.job_id);

    // Get job
    const jobResult = await query(
      `SELECT id, job_number, status, title, client_id, actual_start, actual_hours
       FROM jobs
       WHERE id = $1 AND tenant_id = $2`,
      [input.job_id, context.tenant_id]
    );

    if (jobResult.rows.length === 0) {
      throw new Error(`Job not found: ${input.job_id}`);
    }

    const job = jobResult.rows[0];

    if (job.status !== 'in_progress') {
      throw new Error(`Job cannot be completed from status: ${job.status}`);
    }

    const now = new Date().toISOString();

    // Update job status
    const updateResult = await query(
      `UPDATE jobs
       SET status = $1, actual_end = $2, notes = COALESCE($3, notes), updated_at = $4
       WHERE id = $5 AND tenant_id = $6
       RETURNING actual_start, actual_hours`,
      ['completed', now, input.notes || null, now, input.job_id, context.tenant_id]
    );

    const updated = updateResult.rows[0];

    // Publish event
    await publishEvent({
      id: randomUUID(),
      type: 'job.completed',
      tenant_id: context.tenant_id,
      occurred_at: now,
      actor: { user_id: context.user_id },
      data: {
        job_id: input.job_id,
        job_number: job.job_number,
        title: job.title,
        client_id: job.client_id,
        actual_start: updated.actual_start,
        actual_end: now,
        actual_hours: parseFloat(updated.actual_hours)
      },
      schema: 'urn:jobbuilda:events:job.completed:1'
    });

    return {
      job_id: input.job_id,
      job_number: job.job_number,
      status: 'completed',
      actual_start: updated.actual_start,
      actual_end: now,
      actual_hours: parseFloat(updated.actual_hours)
    };
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
