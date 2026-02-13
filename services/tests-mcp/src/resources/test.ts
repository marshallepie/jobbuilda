import { query } from '../lib/database.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';

const tracer = trace.getTracer('tests-mcp');

export async function handleTestResource(
  uri: string,
  context: AuthContext
): Promise<any> {
  return tracer.startActiveSpan('resource.test', async (span) => {
    try {
      span.setAttributes({
        'resource.uri': uri,
        'tenant.id': context.tenant_id,
      });

      // List all tests: res://tests/tests
      if (uri === 'res://tests/tests') {
        const result = await query(
          `SELECT * FROM tests
          WHERE tenant_id = $1
          ORDER BY test_date DESC, created_at DESC`,
          [context.tenant_id]
        );

        return {
          data: result.rows,
          _meta: { context },
        };
      }

      // Get single test: res://tests/tests/{id}
      const testMatch = uri.match(/^res:\/\/tests\/tests\/([a-f0-9-]+)$/);
      if (testMatch) {
        const testId = testMatch[1];

        const testResult = await query(
          `SELECT * FROM tests WHERE id = $1 AND tenant_id = $2`,
          [testId, context.tenant_id]
        );

        if (testResult.rows.length === 0) {
          throw new Error('Test not found');
        }

        const measurementsResult = await query(
          `SELECT * FROM test_measurements
          WHERE test_id = $1 AND tenant_id = $2
          ORDER BY circuit_ref, measurement_type`,
          [testId, context.tenant_id]
        );

        const certificatesResult = await query(
          `SELECT * FROM test_certificates
          WHERE test_id = $1 AND tenant_id = $2
          ORDER BY issue_date DESC`,
          [testId, context.tenant_id]
        );

        return {
          data: {
            ...testResult.rows[0],
            measurements: measurementsResult.rows,
            certificates: certificatesResult.rows,
          },
          _meta: { context },
        };
      }

      // Get tests for a job: res://tests/job-tests/{job_id}
      const jobMatch = uri.match(/^res:\/\/tests\/job-tests\/([a-f0-9-]+)$/);
      if (jobMatch) {
        const jobId = jobMatch[1];

        const result = await query(
          `SELECT t.*,
            (SELECT COUNT(*) FROM test_measurements WHERE test_id = t.id) as measurement_count,
            (SELECT COUNT(*) FROM test_certificates WHERE test_id = t.id) as certificate_count
          FROM tests t
          WHERE t.job_id = $1 AND t.tenant_id = $2
          ORDER BY t.test_date DESC`,
          [jobId, context.tenant_id]
        );

        return {
          data: {
            job_id: jobId,
            tests: result.rows,
            summary: {
              total_tests: result.rows.length,
              completed: result.rows.filter(t => t.status === 'completed').length,
              in_progress: result.rows.filter(t => t.status === 'in_progress').length,
              scheduled: result.rows.filter(t => t.status === 'scheduled').length,
              satisfactory: result.rows.filter(t => t.outcome === 'satisfactory').length,
              unsatisfactory: result.rows.filter(t => t.outcome === 'unsatisfactory').length,
            },
          },
          _meta: { context },
        };
      }

      throw new Error(`Unknown test resource URI: ${uri}`);
    } finally {
      span.end();
    }
  });
}
