import { trace } from '@opentelemetry/api';
import { query } from '../lib/database.js';

export interface Job {
  id: string;
  tenant_id: string;
  job_number: string;
  quote_id?: string;
  client_id: string;
  site_id: string;
  title: string;
  description?: string;
  status: string;
  scheduled_start?: string;
  scheduled_end?: string;
  actual_start?: string;
  actual_end?: string;
  assigned_to?: string;
  estimated_hours?: number;
  actual_hours: number;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  items?: JobItem[];
  time_entries?: TimeEntry[];
}

export interface JobItem {
  id: string;
  tenant_id: string;
  job_id: string;
  quote_item_id?: string;
  item_type: string;
  description: string;
  quantity_planned: number;
  quantity_used: number;
  unit: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface TimeEntry {
  id: string;
  tenant_id: string;
  job_id: string;
  user_id: string;
  date: string;
  start_time?: string;
  end_time?: string;
  hours: number;
  break_minutes: number;
  description?: string;
  is_overtime: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export async function getJob(jobId: string, tenantId: string, includeDetails = true): Promise<Job | null> {
  const tracer = trace.getTracer('jobs-mcp');
  const span = tracer.startSpan('resource.get_job');

  try {
    span.setAttribute('job_id', jobId);
    span.setAttribute('tenant_id', tenantId);

    const result = await query<Job>(
      `SELECT id, tenant_id, job_number, quote_id, client_id, site_id, title, description,
              status, scheduled_start, scheduled_end, actual_start, actual_end, assigned_to,
              estimated_hours, actual_hours, notes, created_by, created_at, updated_at
       FROM jobs
       WHERE id = $1 AND tenant_id = $2`,
      [jobId, tenantId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const job = result.rows[0];

    if (includeDetails) {
      // Get job items
      const itemsResult = await query<JobItem>(
        `SELECT id, tenant_id, job_id, quote_item_id, item_type, description,
                quantity_planned, quantity_used, unit, status, notes, created_at, updated_at
         FROM job_items
         WHERE job_id = $1 AND tenant_id = $2
         ORDER BY created_at ASC`,
        [jobId, tenantId]
      );
      job.items = itemsResult.rows;

      // Get time entries
      const timeResult = await query<TimeEntry>(
        `SELECT id, tenant_id, job_id, user_id, date, start_time, end_time, hours,
                break_minutes, description, is_overtime, notes, created_at, updated_at
         FROM time_entries
         WHERE job_id = $1 AND tenant_id = $2
         ORDER BY date DESC, start_time DESC`,
        [jobId, tenantId]
      );
      job.time_entries = timeResult.rows;
    }

    return job;
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}

export async function listJobs(tenantId: string, status?: string, assignedTo?: string): Promise<Job[]> {
  const tracer = trace.getTracer('jobs-mcp');
  const span = tracer.startSpan('resource.list_jobs');

  try {
    span.setAttribute('tenant_id', tenantId);
    if (status) span.setAttribute('status', status);
    if (assignedTo) span.setAttribute('assigned_to', assignedTo);

    let whereClause = 'WHERE tenant_id = $1';
    const params: any[] = [tenantId];

    if (status) {
      params.push(status);
      whereClause += ` AND status = $${params.length}`;
    }

    if (assignedTo) {
      params.push(assignedTo);
      whereClause += ` AND assigned_to = $${params.length}`;
    }

    const result = await query<Job>(
      `SELECT id, tenant_id, job_number, quote_id, client_id, site_id, title, description,
              status, scheduled_start, scheduled_end, actual_start, actual_end, assigned_to,
              estimated_hours, actual_hours, notes, created_by, created_at, updated_at
       FROM jobs
       ${whereClause}
       ORDER BY scheduled_start DESC NULLS LAST, created_at DESC`,
      params
    );

    return result.rows;
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}

export async function listJobsByClient(clientId: string, tenantId: string): Promise<Job[]> {
  const tracer = trace.getTracer('jobs-mcp');
  const span = tracer.startSpan('resource.list_jobs_by_client');

  try {
    span.setAttribute('client_id', clientId);
    span.setAttribute('tenant_id', tenantId);

    const result = await query<Job>(
      `SELECT id, tenant_id, job_number, quote_id, client_id, site_id, title, description,
              status, scheduled_start, scheduled_end, actual_start, actual_end, assigned_to,
              estimated_hours, actual_hours, notes, created_by, created_at, updated_at
       FROM jobs
       WHERE client_id = $1 AND tenant_id = $2
       ORDER BY scheduled_start DESC NULLS LAST, created_at DESC`,
      [clientId, tenantId]
    );

    return result.rows;
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
