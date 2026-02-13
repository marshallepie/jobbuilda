import { trace } from '@opentelemetry/api';
import { randomUUID } from 'crypto';
import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { AuthContext } from '@jobbuilda/contracts';

export interface LogTimeInput {
  job_id: string;
  date: string;
  start_time?: string;
  end_time?: string;
  hours?: number;
  break_minutes?: number;
  description?: string;
  is_overtime?: boolean;
  notes?: string;
}

export interface LogTimeOutput {
  time_entry_id: string;
  job_id: string;
  user_id: string;
  date: string;
  hours: number;
  created_at: string;
}

export async function logTime(
  input: LogTimeInput,
  context: AuthContext
): Promise<LogTimeOutput> {
  const tracer = trace.getTracer('jobs-mcp');
  const span = tracer.startSpan('tool.log_time');

  try {
    span.setAttribute('tenant_id', context.tenant_id);
    span.setAttribute('job_id', input.job_id);
    span.setAttribute('user_id', context.user_id);

    // Verify job exists
    const jobResult = await query(
      `SELECT id, job_number, title FROM jobs WHERE id = $1 AND tenant_id = $2`,
      [input.job_id, context.tenant_id]
    );

    if (jobResult.rows.length === 0) {
      throw new Error(`Job not found: ${input.job_id}`);
    }

    const job = jobResult.rows[0];

    // Calculate hours if not provided
    let hours = input.hours;
    if (!hours && input.start_time && input.end_time) {
      const start = new Date(input.start_time);
      const end = new Date(input.end_time);
      const diffMs = end.getTime() - start.getTime();
      const breakMs = (input.break_minutes || 0) * 60 * 1000;
      hours = (diffMs - breakMs) / (1000 * 60 * 60);
      hours = Math.round(hours * 100) / 100; // Round to 2 decimals
    }

    if (!hours || hours <= 0) {
      throw new Error('Invalid hours: must provide either hours or valid start_time/end_time');
    }

    const timeEntryId = randomUUID();
    const now = new Date().toISOString();

    // Create time entry
    await query(
      `INSERT INTO time_entries (id, tenant_id, job_id, user_id, date, start_time, end_time,
                                 hours, break_minutes, description, is_overtime, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        timeEntryId,
        context.tenant_id,
        input.job_id,
        context.user_id,
        input.date,
        input.start_time || null,
        input.end_time || null,
        hours,
        input.break_minutes || 0,
        input.description || null,
        input.is_overtime || false,
        input.notes || null,
        now,
        now
      ]
    );

    // Publish event
    await publishEvent({
      id: randomUUID(),
      type: 'job.time_logged',
      tenant_id: context.tenant_id,
      occurred_at: now,
      actor: { user_id: context.user_id },
      data: {
        time_entry_id: timeEntryId,
        job_id: input.job_id,
        job_number: job.job_number,
        user_id: context.user_id,
        date: input.date,
        hours: hours,
        is_overtime: input.is_overtime || false
      },
      schema: 'urn:jobbuilda:events:job.time_logged:1'
    });

    return {
      time_entry_id: timeEntryId,
      job_id: input.job_id,
      user_id: context.user_id,
      date: input.date,
      hours: hours,
      created_at: now
    };
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
