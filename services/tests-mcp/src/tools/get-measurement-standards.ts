import { query } from '../lib/database.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';

const tracer = trace.getTracer('tests-mcp');

interface GetMeasurementStandardsInput {
  measurement_type: string;
  circuit_type?: string;
  circuit_rating?: string;
}

export async function getMeasurementStandards(
  input: GetMeasurementStandardsInput,
  context: AuthContext
): Promise<any> {
  return tracer.startActiveSpan('tool.get_measurement_standards', async (span) => {
    try {
      span.setAttributes({
        'tenant.id': context.tenant_id,
        'measurement.type': input.measurement_type,
      });

      // Build query based on provided filters
      let queryText = `
        SELECT
          id,
          measurement_type,
          circuit_type,
          circuit_rating,
          min_acceptable,
          max_acceptable,
          standard_reference,
          notes
        FROM test_measurement_standards
        WHERE measurement_type = $1
      `;

      const params: any[] = [input.measurement_type];

      // Add optional filters
      if (input.circuit_type) {
        queryText += ` AND (circuit_type = $${params.length + 1} OR circuit_type IS NULL)`;
        params.push(input.circuit_type);
      }

      if (input.circuit_rating) {
        queryText += ` AND (circuit_rating = $${params.length + 1} OR circuit_rating IS NULL)`;
        params.push(input.circuit_rating);
      }

      // Order by specificity (most specific first)
      queryText += `
        ORDER BY
          (circuit_type IS NOT NULL)::int DESC,
          (circuit_rating IS NOT NULL)::int DESC,
          circuit_type,
          circuit_rating
      `;

      const result = await query(queryText, params);

      // If no standards found, try to get generic standards for the measurement type
      if (result.rows.length === 0 && (input.circuit_type || input.circuit_rating)) {
        const genericResult = await query(
          `SELECT * FROM test_measurement_standards
           WHERE measurement_type = $1
           AND circuit_type IS NULL
           AND circuit_rating IS NULL`,
          [input.measurement_type]
        );

        if (genericResult.rows.length > 0) {
          span.addEvent('using_generic_standards');
          return {
            standards: genericResult.rows,
            is_generic: true,
            message: `No specific standards found for ${input.circuit_type || ''} ${input.circuit_rating || ''}. Using generic standards.`
          };
        }
      }

      span.setStatus({ code: 1 });
      span.setAttribute('standards.count', result.rows.length);

      return {
        standards: result.rows,
        is_generic: false,
        count: result.rows.length
      };
    } catch (error) {
      span.setStatus({ code: 2, message: (error as Error).message });
      throw error;
    } finally {
      span.end();
    }
  });
}
