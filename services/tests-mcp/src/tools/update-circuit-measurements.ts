import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { validateMeasurement, ValidationResult } from '../lib/measurement-validator.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';
import { randomUUID } from 'crypto';

const tracer = trace.getTracer('tests-mcp');

interface CircuitMeasurements {
  continuity_r1_r2?: number;
  insulation_resistance?: number;
  earth_loop_impedance?: number;
  polarity_correct?: boolean;
  // Additional measurements can be added as needed
}

interface UpdateCircuitMeasurementsInput {
  circuit_id: string;
  measurements: CircuitMeasurements;
  notes?: string;
}

interface MeasurementValidationResults {
  continuity?: ValidationResult;
  insulation?: ValidationResult;
  earth_loop?: ValidationResult;
  overall_result: 'satisfactory' | 'unsatisfactory' | 'requires_improvement';
  all_pass: boolean;
}

export async function updateCircuitMeasurements(
  input: UpdateCircuitMeasurementsInput,
  context: AuthContext
): Promise<any> {
  return tracer.startActiveSpan('tool.update_circuit_measurements', async (span) => {
    try {
      span.setAttributes({
        'tenant.id': context.tenant_id,
        'circuit.id': input.circuit_id,
      });

      // Fetch circuit with details for validation
      const circuitResult = await query(
        `SELECT * FROM test_circuits
         WHERE id = $1 AND tenant_id = $2`,
        [input.circuit_id, context.tenant_id]
      );

      if (circuitResult.rows.length === 0) {
        throw new Error('Circuit not found');
      }

      const circuit = circuitResult.rows[0];
      const validationResults: MeasurementValidationResults = {
        overall_result: 'satisfactory',
        all_pass: true
      };

      // Validate continuity (R1+R2)
      if (input.measurements.continuity_r1_r2 !== undefined) {
        const validation = await validateMeasurement(
          'continuity',
          input.measurements.continuity_r1_r2,
          {
            circuit_type: circuit.circuit_type,
            circuit_rating: circuit.overcurrent_device_rating
          },
          context.tenant_id
        );
        validationResults.continuity = validation;
        if (!validation.pass) {
          validationResults.all_pass = false;
          validationResults.overall_result = 'unsatisfactory';
        }
      }

      // Validate insulation resistance
      if (input.measurements.insulation_resistance !== undefined) {
        const validation = await validateMeasurement(
          'insulation',
          input.measurements.insulation_resistance,
          {
            circuit_type: circuit.circuit_type,
            circuit_rating: circuit.overcurrent_device_rating
          },
          context.tenant_id
        );
        validationResults.insulation = validation;
        if (!validation.pass) {
          validationResults.all_pass = false;
          validationResults.overall_result = 'unsatisfactory';
        }
      }

      // Validate earth loop impedance (Zs)
      if (input.measurements.earth_loop_impedance !== undefined) {
        const validation = await validateMeasurement(
          'earth_loop',
          input.measurements.earth_loop_impedance,
          {
            circuit_type: circuit.circuit_type,
            circuit_rating: circuit.overcurrent_device_rating
          },
          context.tenant_id
        );
        validationResults.earth_loop = validation;
        if (!validation.pass) {
          validationResults.all_pass = false;
          validationResults.overall_result = 'unsatisfactory';
        }
      }

      // Check polarity
      if (input.measurements.polarity_correct === false) {
        validationResults.all_pass = false;
        validationResults.overall_result = 'unsatisfactory';
      }

      // Determine test result based on validations
      const testResult = validationResults.all_pass ? 'satisfactory' : 'unsatisfactory';

      // Build update fields dynamically
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (input.measurements.continuity_r1_r2 !== undefined) {
        updateFields.push(`continuity_r1_r2 = $${paramIndex++}`);
        updateValues.push(input.measurements.continuity_r1_r2);
      }

      if (input.measurements.insulation_resistance !== undefined) {
        updateFields.push(`insulation_resistance = $${paramIndex++}`);
        updateValues.push(input.measurements.insulation_resistance);
      }

      if (input.measurements.earth_loop_impedance !== undefined) {
        updateFields.push(`earth_loop_impedance = $${paramIndex++}`);
        updateValues.push(input.measurements.earth_loop_impedance);
      }

      if (input.measurements.polarity_correct !== undefined) {
        updateFields.push(`polarity_correct = $${paramIndex++}`);
        updateValues.push(input.measurements.polarity_correct);
      }

      // Always update test result
      updateFields.push(`test_result = $${paramIndex++}`);
      updateValues.push(testResult);

      // Add notes if provided
      if (input.notes) {
        updateFields.push(`defects_noted = $${paramIndex++}`);
        updateValues.push(input.notes);
      }

      // Add WHERE clause parameters
      updateValues.push(input.circuit_id);
      updateValues.push(context.tenant_id);

      // Update circuit
      const result = await query(
        `UPDATE test_circuits
         SET ${updateFields.join(', ')}
         WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex++}
         RETURNING *`,
        updateValues
      );

      const updatedCircuit = result.rows[0];

      // Publish event
      await publishEvent({
        id: randomUUID(),
        type: 'tests.circuit_measurements_updated',
        tenant_id: context.tenant_id,
        occurred_at: new Date().toISOString(),
        actor: { user_id: context.user_id },
        data: {
          circuit_id: input.circuit_id,
          test_id: circuit.test_id,
          test_result: testResult,
          validation_results: validationResults,
        },
        schema: 'urn:jobbuilda:events:tests.circuit_measurements_updated:1'
      });

      span.setStatus({ code: 1 });
      return {
        circuit: updatedCircuit,
        validation: validationResults
      };
    } catch (error) {
      span.setStatus({ code: 2, message: (error as Error).message });
      throw error;
    } finally {
      span.end();
    }
  });
}
