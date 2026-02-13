import pg from 'pg';
import { trace } from '@opentelemetry/api';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const tracer = trace.getTracer('reporting-mcp');

export async function query(text: string, params?: any[]) {
  const span = tracer.startSpan('db.query');
  span.setAttribute('db.system', 'postgresql');
  span.setAttribute('db.statement', text);

  try {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    span.setAttribute('db.duration_ms', duration);
    span.setAttribute('db.rows_returned', res.rowCount || 0);
    return res;
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}

export async function getClient() {
  return await pool.connect();
}

export { pool };
