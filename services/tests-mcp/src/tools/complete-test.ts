import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';
import { randomUUID } from 'crypto';

const tracer = trace.getTracer('tests-mcp');

interface CompleteTestInput {
  test_id: string;
  outcome: 'satisfactory' | 'unsatisfactory' | 'requires_improvement';
  completion_date?: string;
  notes?: string;
}

export async function completeTest(
  input: CompleteTestInput,
  context: AuthContext
): Promise<any> {
  return tracer.startActiveSpan('tool.complete_test', async (span) => {
    try {
      span.setAttributes({
        'tenant.id': context.tenant_id,
        'test.id': input.test_id,
        'outcome': input.outcome,
      });

      // Get test
      const getResult = await query(
        `SELECT * FROM tests WHERE id = $1 AND tenant_id = $2`,
        [input.test_id, context.tenant_id]
      );

      if (getResult.rows.length === 0) {
        throw new Error('Test not found');
      }

      const test = getResult.rows[0];

      // Update test status
      const result = await query(
        `UPDATE tests
        SET status = 'completed',
            outcome = $1,
            completion_date = $2,
            notes = COALESCE(notes || E'\\n\\n', '') || $3,
            updated_at = NOW()
        WHERE id = $4 AND tenant_id = $5
        RETURNING *`,
        [
          input.outcome,
          input.completion_date || new Date().toISOString().split('T')[0],
          input.notes || `Test completed with outcome: ${input.outcome}`,
          input.test_id,
          context.tenant_id,
        ]
      );

      // Publish event
      await publishEvent({
        id: randomUUID(),
        type: 'tests.test_completed',
        tenant_id: context.tenant_id,
        occurred_at: new Date().toISOString(),
        actor: { user_id: context.user_id },
        data: {
          test_id: input.test_id,
          test_number: test.test_number,
          test_type: test.test_type,
          job_id: test.job_id,
          outcome: input.outcome,
        },
        schema: 'urn:jobbuilda:events:tests.test_completed:1',
      });

      return result.rows[0];
    } finally {
      span.end();
    }
  });
}
