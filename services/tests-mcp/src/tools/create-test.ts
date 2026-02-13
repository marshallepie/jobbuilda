import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';
import { randomUUID } from 'crypto';

const tracer = trace.getTracer('tests-mcp');

interface CreateTestInput {
  job_id: string;
  client_id: string;
  site_id: string;
  test_type: 'eicr' | 'pat' | 'initial_verification' | 'periodic_inspection' | 'minor_works';
  title: string;
  description?: string;
  test_date?: string;
  next_inspection_date?: string;
  notes?: string;
}

export async function createTest(
  input: CreateTestInput,
  context: AuthContext
): Promise<any> {
  return tracer.startActiveSpan('tool.create_test', async (span) => {
    try {
      span.setAttributes({
        'tenant.id': context.tenant_id,
        'job.id': input.job_id,
        'test.type': input.test_type,
      });

      const testId = randomUUID();

      // Generate test number
      const numberResult = await query(
        `SELECT generate_test_number($1, $2) as number`,
        [context.tenant_id, input.test_type]
      );
      const testNumber = numberResult.rows[0].number;

      // Insert test
      const result = await query(
        `INSERT INTO tests (
          id, tenant_id, test_number, job_id, client_id, site_id,
          test_type, title, description, test_date, next_inspection_date,
          tested_by, notes, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          testId,
          context.tenant_id,
          testNumber,
          input.job_id,
          input.client_id,
          input.site_id,
          input.test_type,
          input.title,
          input.description || null,
          input.test_date || null,
          input.next_inspection_date || null,
          context.user_id,
          input.notes || null,
          input.test_date ? 'in_progress' : 'scheduled',
        ]
      );

      const test = result.rows[0];

      // Publish event
      await publishEvent({
        id: randomUUID(),
        type: 'tests.test_created',
        tenant_id: context.tenant_id,
        occurred_at: new Date().toISOString(),
        actor: { user_id: context.user_id },
        data: {
          test_id: testId,
          test_number: testNumber,
          test_type: input.test_type,
          job_id: input.job_id,
        },
        schema: 'urn:jobbuilda:events:tests.test_created:1',
      });

      return test;
    } finally {
      span.end();
    }
  });
}
