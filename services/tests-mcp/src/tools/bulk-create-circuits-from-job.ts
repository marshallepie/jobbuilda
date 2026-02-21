import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';
import { randomUUID } from 'crypto';
import { createCircuit } from './create-circuit.js';

const tracer = trace.getTracer('tests-mcp');

interface BulkCreateCircuitsInput {
  test_id: string;
  job_id: string;
}

interface CircuitFromJob {
  circuit_reference: string;
  location?: string;
  overcurrent_device_type?: string;
  overcurrent_device_rating?: string;
}

export async function bulkCreateCircuitsFromJob(
  input: BulkCreateCircuitsInput,
  context: AuthContext
): Promise<any> {
  return tracer.startActiveSpan('tool.bulk_create_circuits_from_job', async (span) => {
    try {
      span.setAttributes({
        'tenant.id': context.tenant_id,
        'test.id': input.test_id,
        'job.id': input.job_id,
      });

      // Fetch job circuit details from jobs-mcp
      // Note: In a distributed system, we'd call jobs-mcp via MCP
      // For MVP with shared DB, we can query directly
      const jobResult = await query(
        `SELECT circuit_details FROM jobs
         WHERE id = $1 AND tenant_id = $2`,
        [input.job_id, context.tenant_id]
      );

      if (jobResult.rows.length === 0) {
        throw new Error('Job not found');
      }

      const job = jobResult.rows[0];
      const circuitDetails = job.circuit_details as CircuitFromJob[] | null;

      if (!circuitDetails || !Array.isArray(circuitDetails) || circuitDetails.length === 0) {
        return {
          message: 'No circuit details found in job',
          circuits_created: 0,
          circuits: []
        };
      }

      // Verify test exists
      const testCheck = await query(
        `SELECT id FROM tests WHERE id = $1 AND tenant_id = $2`,
        [input.test_id, context.tenant_id]
      );

      if (testCheck.rows.length === 0) {
        throw new Error('Test not found');
      }

      // Create circuits
      const createdCircuits = [];
      for (const circuitDetail of circuitDetails) {
        try {
          const circuit = await createCircuit(
            {
              test_id: input.test_id,
              circuit_reference: circuitDetail.circuit_reference,
              location: circuitDetail.location,
              overcurrent_device_type: circuitDetail.overcurrent_device_type,
              overcurrent_device_rating: circuitDetail.overcurrent_device_rating,
            },
            context
          );
          createdCircuits.push(circuit);
        } catch (error) {
          // Log error but continue with other circuits
          console.error(`Failed to create circuit ${circuitDetail.circuit_reference}:`, error);
          span.addEvent('circuit_creation_failed', {
            circuit_reference: circuitDetail.circuit_reference,
            error: (error as Error).message
          });
        }
      }

      // Publish bulk event
      await publishEvent({
        id: randomUUID(),
        type: 'tests.circuits_bulk_created',
        tenant_id: context.tenant_id,
        occurred_at: new Date().toISOString(),
        actor: { user_id: context.user_id },
        data: {
          test_id: input.test_id,
          job_id: input.job_id,
          circuits_created: createdCircuits.length,
          circuit_ids: createdCircuits.map(c => c.id),
        },
        schema: 'urn:jobbuilda:events:tests.circuits_bulk_created:1'
      });

      span.setStatus({ code: 1 });
      span.setAttribute('circuits.created', createdCircuits.length);

      return {
        message: `Created ${createdCircuits.length} circuits from job`,
        circuits_created: createdCircuits.length,
        circuits: createdCircuits
      };
    } catch (error) {
      span.setStatus({ code: 2, message: (error as Error).message });
      throw error;
    } finally {
      span.end();
    }
  });
}
