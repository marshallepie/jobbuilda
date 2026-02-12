import { User } from '@jobbuilda/contracts';
import { trace } from '@opentelemetry/api';
import { query } from '../lib/database.js';

export async function getUser(userId: string, tenantId: string): Promise<User | null> {
  const tracer = trace.getTracer('identity-mcp');
  const span = tracer.startSpan('resource.get_user');

  try {
    span.setAttribute('user_id', userId);
    span.setAttribute('tenant_id', tenantId);

    const result = await query<User>(
      `SELECT id, tenant_id, email, name, role, created_at, updated_at
       FROM users
       WHERE id = $1 AND tenant_id = $2`,
      [userId, tenantId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
