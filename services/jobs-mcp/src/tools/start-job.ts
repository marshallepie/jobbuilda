import { trace } from '@opentelemetry/api';
import { randomUUID } from 'crypto';
import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { AuthContext } from '@jobbuilda/contracts';

export interface StartJobInput {
  job_id: string;
}

export interface StartJobOutput {
  job_id: string;
  job_number: string;
  status: string;
  actual_start: string;
}

export async function startJob(
  input: StartJobInput,
  context: AuthContext
): Promise<StartJobOutput> {
  const tracer = trace.getTracer('jobs-mcp');
  const span = tracer.startSpan('tool.start_job');

  try {
    span.setAttribute('tenant_id', context.tenant_id);
    span.setAttribute('job_id', input.job_id);

    // Get job
    const jobResult = await query(
      `SELECT id, job_number, status, title, client_id
       FROM jobs
       WHERE id = $1 AND tenant_id = $2`,
      [input.job_id, context.tenant_id]
    );

    if (jobResult.rows.length === 0) {
      throw new Error(`Job not found: ${input.job_id}`);
    }

    const job = jobResult.rows[0];

    if (job.status !== 'scheduled') {
      throw new Error(`Job cannot be started from status: ${job.status}`);
    }

    const now = new Date().toISOString();

    // Update job status
    await query(
      `UPDATE jobs
       SET status = $1, actual_start = $2, updated_at = $3
       WHERE id = $4 AND tenant_id = $5`,
      ['in_progress', now, now, input.job_id, context.tenant_id]
    );

    // Publish event
    await publishEvent({
      id: randomUUID(),
      type: 'job.started',
      tenant_id: context.tenant_id,
      occurred_at: now,
      actor: { user_id: context.user_id },
      data: {
        job_id: input.job_id,
        job_number: job.job_number,
        title: job.title,
        client_id: job.client_id,
        actual_start: now
      },
      schema: 'urn:jobbuilda:events:job.started:1'
    });

    return {
      job_id: input.job_id,
      job_number: job.job_number,
      status: 'in_progress',
      actual_start: now
    };
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
