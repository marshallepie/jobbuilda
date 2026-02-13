import { query } from '../lib/database.js';

interface AuthContext {
  tenant_id: string;
  user_id: string;
  scopes: string[];
}

export async function handleProfitLossResource(uri: string, context?: AuthContext) {
  if (!context) {
    throw new Error('Authentication context required');
  }

  // Parse URI: res://reporting/profit-loss?start=2026-01-01&end=2026-12-31
  const url = new URL(uri.replace('res://', 'http://dummy/'));
  const startDate = url.searchParams.get('start');
  const endDate = url.searchParams.get('end');

  if (!startDate || !endDate) {
    throw new Error('start and end query parameters required');
  }

  // Check for cached report
  const cachedResult = await query(
    `SELECT data FROM report_snapshots
     WHERE tenant_id = $1
       AND report_type = 'profit_loss'
       AND period_start = $2
       AND period_end = $3
       AND NOT invalidated
       AND (valid_until IS NULL OR valid_until > NOW())
     ORDER BY generated_at DESC
     LIMIT 1`,
    [context.tenant_id, startDate, endDate]
  );

  if (cachedResult.rows.length > 0) {
    return cachedResult.rows[0].data;
  }

  // Generate report from financial_events
  const result = await query(
    `SELECT
       category,
       SUM(amount_ex_vat) as total_ex_vat,
       SUM(vat_amount) as total_vat,
       SUM(amount_inc_vat) as total_inc_vat
     FROM financial_events
     WHERE tenant_id = $1
       AND occurred_at >= $2::date
       AND occurred_at < ($3::date + INTERVAL '1 day')
     GROUP BY category`,
    [context.tenant_id, startDate, endDate]
  );

  // Calculate totals
  const revenue = result.rows.find(r => r.category === 'revenue') || {
    total_ex_vat: 0,
    total_vat: 0,
    total_inc_vat: 0,
  };
  const costs = result.rows.find(r => r.category === 'cost') || {
    total_ex_vat: 0,
    total_vat: 0,
    total_inc_vat: 0,
  };

  const report = {
    period: {
      start: startDate,
      end: endDate,
    },
    revenue: {
      total_ex_vat: parseFloat(revenue.total_ex_vat || 0),
      total_vat: parseFloat(revenue.total_vat || 0),
      total_inc_vat: parseFloat(revenue.total_inc_vat || 0),
    },
    costs: {
      total_ex_vat: parseFloat(costs.total_ex_vat || 0),
      total_vat: parseFloat(costs.total_vat || 0),
      total_inc_vat: parseFloat(costs.total_inc_vat || 0),
    },
    profit: {
      gross_profit: parseFloat(revenue.total_ex_vat || 0) - parseFloat(costs.total_ex_vat || 0),
      vat_balance: parseFloat(revenue.total_vat || 0) - parseFloat(costs.total_vat || 0),
    },
    generated_at: new Date().toISOString(),
  };

  return report;
}
