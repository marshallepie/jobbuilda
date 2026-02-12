import { AuthContext } from '@jobbuilda/contracts';
import { trace } from '@opentelemetry/api';
import { query } from '../lib/database.js';

export interface CheckPermissionInput {
  user_id: string;
  scope: string;
}

export interface CheckPermissionResult {
  has_permission: boolean;
  user_id: string;
  scope: string;
}

export async function checkPermission(
  input: CheckPermissionInput,
  context: AuthContext
): Promise<CheckPermissionResult> {
  const tracer = trace.getTracer('identity-mcp');
  const span = tracer.startSpan('tool.check_permission');

  try {
    span.setAttribute('user_id', input.user_id);
    span.setAttribute('scope', input.scope);
    span.setAttribute('tenant_id', context.tenant_id);

    // Query permissions table
    const result = await query<{ exists: boolean }>(
      `SELECT EXISTS(
        SELECT 1 FROM permissions p
        JOIN users u ON p.user_id = u.id
        WHERE p.user_id = $1
          AND p.scope = $2
          AND u.tenant_id = $3
      ) as exists`,
      [input.user_id, input.scope, context.tenant_id]
    );

    const hasPermission = result.rows[0]?.exists || false;
    span.setAttribute('has_permission', hasPermission);

    return {
      has_permission: hasPermission,
      user_id: input.user_id,
      scope: input.scope
    };
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
