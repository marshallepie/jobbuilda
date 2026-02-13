import { randomUUID } from 'crypto';
import { query } from '../lib/database.js';
import { publish } from '../lib/event-bus.js';

interface AuthContext {
  tenant_id: string;
  user_id: string;
  scopes: string[];
}

interface GenerateReportInput {
  report_type: 'profit_loss' | 'invoice_summary' | 'payment_summary' | 'job_summary';
  period_start: string;
  period_end: string;
  cache_duration_hours?: number;
}

export async function generateReport(input: GenerateReportInput, context: AuthContext) {
  const { report_type, period_start, period_end, cache_duration_hours = 24 } = input;

  // Generate report data based on type
  let reportData: any = {};

  if (report_type === 'profit_loss') {
    const result = await query(
      `SELECT
         category,
         SUM(amount_ex_vat) as total_ex_vat,
         SUM(vat_amount) as total_vat,
         SUM(amount_inc_vat) as total_inc_vat,
         COUNT(*) as transaction_count
       FROM financial_events
       WHERE tenant_id = $1
         AND occurred_at >= $2::date
         AND occurred_at < ($3::date + INTERVAL '1 day')
       GROUP BY category`,
      [context.tenant_id, period_start, period_end]
    );

    const revenue = result.rows.find(r => r.category === 'revenue');
    const costs = result.rows.find(r => r.category === 'cost');

    reportData = {
      type: 'profit_loss',
      period: { start: period_start, end: period_end },
      revenue: {
        total_ex_vat: parseFloat(revenue?.total_ex_vat || 0),
        total_vat: parseFloat(revenue?.total_vat || 0),
        total_inc_vat: parseFloat(revenue?.total_inc_vat || 0),
        transaction_count: parseInt(revenue?.transaction_count || 0),
      },
      costs: {
        total_ex_vat: parseFloat(costs?.total_ex_vat || 0),
        total_vat: parseFloat(costs?.total_vat || 0),
        total_inc_vat: parseFloat(costs?.total_inc_vat || 0),
        transaction_count: parseInt(costs?.transaction_count || 0),
      },
      profit: {
        gross_profit: parseFloat(revenue?.total_ex_vat || 0) - parseFloat(costs?.total_ex_vat || 0),
        vat_balance: parseFloat(revenue?.total_vat || 0) - parseFloat(costs?.total_vat || 0),
      },
    };
  } else {
    // Placeholder for other report types
    reportData = {
      type: report_type,
      period: { start: period_start, end: period_end },
      message: `Report type ${report_type} not yet implemented`,
    };
  }

  // Store snapshot
  const snapshotId = randomUUID();
  const validUntil = new Date();
  validUntil.setHours(validUntil.getHours() + cache_duration_hours);

  await query(
    `INSERT INTO report_snapshots (id, tenant_id, report_type, period_start, period_end, data, generated_by, valid_until)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (tenant_id, report_type, period_start, period_end)
     DO UPDATE SET data = $6, generated_at = NOW(), generated_by = $7, valid_until = $8, invalidated = FALSE
     RETURNING *`,
    [snapshotId, context.tenant_id, report_type, period_start, period_end, JSON.stringify(reportData), context.user_id, validUntil]
  );

  // Publish event
  await publish({
    id: randomUUID(),
    type: 'reporting.report_generated',
    tenant_id: context.tenant_id,
    occurred_at: new Date().toISOString(),
    actor: { user_id: context.user_id },
    data: {
      report_type,
      period_start,
      period_end,
      snapshot_id: snapshotId,
    },
    schema: 'urn:jobbuilda:events:reporting.report_generated:1',
  });

  return {
    success: true,
    report: reportData,
    snapshot_id: snapshotId,
    valid_until: validUntil.toISOString(),
  };
}
