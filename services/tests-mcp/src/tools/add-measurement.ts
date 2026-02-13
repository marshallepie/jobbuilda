import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';
import { randomUUID } from 'crypto';

const tracer = trace.getTracer('tests-mcp');

interface AddMeasurementInput {
  test_id: string;
  circuit_ref?: string;
  measurement_type: 'continuity' | 'insulation' | 'earth_loop' | 'rcd' | 'polarity' | 'voltage';
  measurement_name: string;
  value: number;
  unit: string;
  min_acceptable?: number;
  max_acceptable?: number;
  notes?: string;
}

export async function addMeasurement(
  input: AddMeasurementInput,
  context: AuthContext
): Promise<any> {
  return tracer.startActiveSpan('tool.add_measurement', async (span) => {
    try {
      span.setAttributes({
        'tenant.id': context.tenant_id,
        'test.id': input.test_id,
        'measurement.type': input.measurement_type,
      });

      // Verify test exists
      const testResult = await query(
        `SELECT * FROM tests WHERE id = $1 AND tenant_id = $2`,
        [input.test_id, context.tenant_id]
      );

      if (testResult.rows.length === 0) {
        throw new Error('Test not found');
      }

      // Determine if measurement passes
      let pass: boolean | null = null;
      if (input.min_acceptable !== undefined && input.max_acceptable !== undefined) {
        pass = input.value >= input.min_acceptable && input.value <= input.max_acceptable;
      } else if (input.min_acceptable !== undefined) {
        pass = input.value >= input.min_acceptable;
      } else if (input.max_acceptable !== undefined) {
        pass = input.value <= input.max_acceptable;
      }

      // Insert measurement
      const result = await query(
        `INSERT INTO test_measurements (
          tenant_id, test_id, circuit_ref, measurement_type, measurement_name,
          value, unit, min_acceptable, max_acceptable, pass, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          context.tenant_id,
          input.test_id,
          input.circuit_ref || null,
          input.measurement_type,
          input.measurement_name,
          input.value,
          input.unit,
          input.min_acceptable || null,
          input.max_acceptable || null,
          pass,
          input.notes || null,
        ]
      );

      return result.rows[0];
    } finally {
      span.end();
    }
  });
}
