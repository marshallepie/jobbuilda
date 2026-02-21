import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';
import { randomUUID } from 'crypto';

const tracer = trace.getTracer('tests-mcp');

interface CreateCircuitInput {
  test_id: string;
  circuit_reference: string;
  circuit_description?: string;
  location?: string;
  circuit_type?: 'ring_final' | 'radial' | 'lighting' | 'cooker' | 'shower' | 'immersion' | 'ev_charger' | 'other';
  conductor_csa?: string;
  cpc_csa?: string;
  overcurrent_device_type?: string;
  overcurrent_device_rating?: string;
  overcurrent_device_location?: string;
  rcd_protected?: boolean;
  rcd_rating?: string;
  rcd_type?: string;
  max_demand_amps?: number;
  circuit_length_meters?: number;
}

export async function createCircuit(
  input: CreateCircuitInput,
  context: AuthContext
): Promise<any> {
  return tracer.startActiveSpan('tool.create_circuit', async (span) => {
    try {
      span.setAttributes({
        'tenant.id': context.tenant_id,
        'test.id': input.test_id,
        'circuit.reference': input.circuit_reference,
      });

      // Verify test exists and belongs to tenant
      const testCheck = await query(
        `SELECT id FROM tests WHERE id = $1 AND tenant_id = $2`,
        [input.test_id, context.tenant_id]
      );

      if (testCheck.rows.length === 0) {
        throw new Error('Test not found');
      }

      // Check for duplicate circuit reference
      const duplicateCheck = await query(
        `SELECT id FROM test_circuits
         WHERE test_id = $1 AND circuit_reference = $2`,
        [input.test_id, input.circuit_reference]
      );

      if (duplicateCheck.rows.length > 0) {
        throw new Error(`Circuit reference '${input.circuit_reference}' already exists for this test`);
      }

      const circuitId = randomUUID();

      // Insert circuit
      const result = await query(
        `INSERT INTO test_circuits (
          id, tenant_id, test_id, circuit_reference, circuit_description,
          location, circuit_type, conductor_csa, cpc_csa,
          overcurrent_device_type, overcurrent_device_rating, overcurrent_device_location,
          rcd_protected, rcd_rating, rcd_type, max_demand_amps, circuit_length_meters,
          test_result
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *`,
        [
          circuitId,
          context.tenant_id,
          input.test_id,
          input.circuit_reference,
          input.circuit_description || null,
          input.location || null,
          input.circuit_type || null,
          input.conductor_csa || null,
          input.cpc_csa || null,
          input.overcurrent_device_type || null,
          input.overcurrent_device_rating || null,
          input.overcurrent_device_location || null,
          input.rcd_protected || false,
          input.rcd_rating || null,
          input.rcd_type || null,
          input.max_demand_amps || null,
          input.circuit_length_meters || null,
          'not_tested'
        ]
      );

      const circuit = result.rows[0];

      // Publish event
      await publishEvent({
        id: randomUUID(),
        type: 'tests.circuit_created',
        tenant_id: context.tenant_id,
        occurred_at: new Date().toISOString(),
        actor: { user_id: context.user_id },
        data: {
          circuit_id: circuitId,
          test_id: input.test_id,
          circuit_reference: input.circuit_reference,
        },
        schema: 'urn:jobbuilda:events:tests.circuit_created:1'
      });

      span.setStatus({ code: 1 });
      return circuit;
    } catch (error) {
      span.setStatus({ code: 2, message: (error as Error).message });
      throw error;
    } finally {
      span.end();
    }
  });
}
