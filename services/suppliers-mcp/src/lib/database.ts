import pg from 'pg';
import { trace } from '@opentelemetry/api';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getDatabase(): pg.Pool {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    pool = new Pool({
      connectionString: databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    });
  }

  return pool;
}

/**
 * Execute a traced database query
 */
export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  const tracer = trace.getTracer('suppliers-mcp');
  const span = tracer.startSpan('db.query', {
    attributes: {
      'db.system': 'postgresql',
      'db.statement': text
    }
  });

  try {
    const db = getDatabase();
    const result = await db.query<T>(text, params);
    span.setAttribute('db.rows_returned', result.rowCount || 0);
    return result;
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
