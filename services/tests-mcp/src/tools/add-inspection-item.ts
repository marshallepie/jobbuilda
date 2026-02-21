import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';
import { randomUUID } from 'crypto';

const tracer = trace.getTracer('tests-mcp');

interface AddInspectionItemInput {
  test_id: string;
  item_code: string;
  result: 'pass' | 'fail' | 'n/a' | 'limitation';
  notes?: string;
}

export async function addInspectionItem(
  input: AddInspectionItemInput,
  context: AuthContext
): Promise<any> {
  return tracer.startActiveSpan('tool.add_inspection_item', async (span) => {
    try {
      span.setAttributes({
        'tenant.id': context.tenant_id,
        'test.id': input.test_id,
        'item.code': input.item_code,
        'item.result': input.result,
      });

      // Fetch test
      const testResult = await query(
        `SELECT id, test_type, schedule_of_inspections FROM tests
         WHERE id = $1 AND tenant_id = $2`,
        [input.test_id, context.tenant_id]
      );

      if (testResult.rows.length === 0) {
        throw new Error('Test not found');
      }

      const test = testResult.rows[0];
      let schedule = test.schedule_of_inspections || { items: [] };

      // Ensure schedule has items array
      if (!schedule.items) {
        schedule.items = [];
      }

      // Find existing item or add new one
      const existingIndex = schedule.items.findIndex((item: any) => item.item_code === input.item_code);

      const inspectionItem = {
        item_code: input.item_code,
        result: input.result,
        notes: input.notes || null,
        inspected_at: new Date().toISOString(),
        inspected_by: context.user_id,
      };

      if (existingIndex >= 0) {
        // Update existing item
        schedule.items[existingIndex] = inspectionItem;
      } else {
        // Add new item
        schedule.items.push(inspectionItem);
      }

      // Update test with new schedule
      const updateResult = await query(
        `UPDATE tests
         SET schedule_of_inspections = $1
         WHERE id = $2 AND tenant_id = $3
         RETURNING *`,
        [JSON.stringify(schedule), input.test_id, context.tenant_id]
      );

      const updatedTest = updateResult.rows[0];

      // Calculate completion progress
      const totalItems = schedule.items.length;
      const completedItems = schedule.items.filter(
        (item: any) => item.result !== null && item.result !== undefined
      ).length;
      const completionPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

      // Publish event
      await publishEvent({
        id: randomUUID(),
        type: 'tests.inspection_item_added',
        tenant_id: context.tenant_id,
        occurred_at: new Date().toISOString(),
        actor: { user_id: context.user_id },
        data: {
          test_id: input.test_id,
          item_code: input.item_code,
          result: input.result,
          completion_percent: completionPercent,
        },
        schema: 'urn:jobbuilda:events:tests.inspection_item_added:1'
      });

      span.setStatus({ code: 1 });
      span.setAttribute('completion.percent', completionPercent);

      return {
        test: updatedTest,
        inspection_item: inspectionItem,
        progress: {
          total_items: totalItems,
          completed_items: completedItems,
          completion_percent: completionPercent,
        }
      };
    } catch (error) {
      span.setStatus({ code: 2, message: (error as Error).message });
      throw error;
    } finally {
      span.end();
    }
  });
}
