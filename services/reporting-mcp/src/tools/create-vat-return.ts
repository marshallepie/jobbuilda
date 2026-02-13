import { randomUUID } from 'crypto';
import { query } from '../lib/database.js';
import { publish } from '../lib/event-bus.js';

interface AuthContext {
  tenant_id: string;
  user_id: string;
  scopes: string[];
}

interface CreateVatReturnInput {
  period_start: string;
  period_end: string;
}

export async function createVatReturn(input: CreateVatReturnInput, context: AuthContext) {
  const { period_start, period_end } = input;

  // Calculate VAT boxes from financial_events
  const result = await query(
    `SELECT
       category,
       SUM(amount_ex_vat) as total_ex_vat,
       SUM(vat_amount) as total_vat
     FROM financial_events
     WHERE tenant_id = $1
       AND occurred_at >= $2::date
       AND occurred_at < ($3::date + INTERVAL '1 day')
       AND category IN ('revenue', 'cost')
     GROUP BY category`,
    [context.tenant_id, period_start, period_end]
  );

  const revenue = result.rows.find(r => r.category === 'revenue');
  const costs = result.rows.find(r => r.category === 'cost');

  // HMRC VAT100 box calculations
  const box1VatDueSales = parseFloat(revenue?.total_vat || 0);
  const box2VatDueAcquisitions = 0; // Not applicable for most small businesses
  const box3TotalVatDue = box1VatDueSales + box2VatDueAcquisitions;
  const box4VatReclaimed = parseFloat(costs?.total_vat || 0);
  const box5NetVatDue = box3TotalVatDue - box4VatReclaimed;
  const box6TotalValueSales = parseFloat(revenue?.total_ex_vat || 0);
  const box7TotalValuePurchases = parseFloat(costs?.total_ex_vat || 0);
  const box8TotalValueSupplies = box6TotalValueSales;
  const box9TotalValueAcquisitions = 0;

  // Create VAT return
  const returnId = randomUUID();
  const vatResult = await query(
    `INSERT INTO vat_returns (
       id, tenant_id, period_start, period_end,
       box1_vat_due_sales, box2_vat_due_acquisitions, box3_total_vat_due,
       box4_vat_reclaimed, box5_net_vat_due,
       box6_total_value_sales_ex_vat, box7_total_value_purchases_ex_vat,
       box8_total_value_supplies_ex_vat, box9_total_value_acquisitions_ex_vat,
       created_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [
      returnId,
      context.tenant_id,
      period_start,
      period_end,
      Math.round(box1VatDueSales * 100) / 100,
      Math.round(box2VatDueAcquisitions * 100) / 100,
      Math.round(box3TotalVatDue * 100) / 100,
      Math.round(box4VatReclaimed * 100) / 100,
      Math.round(box5NetVatDue * 100) / 100,
      Math.round(box6TotalValueSales * 100) / 100,
      Math.round(box7TotalValuePurchases * 100) / 100,
      Math.round(box8TotalValueSupplies * 100) / 100,
      Math.round(box9TotalValueAcquisitions * 100) / 100,
      context.user_id,
    ]
  );

  const vatReturn = vatResult.rows[0];

  // Publish event
  await publish({
    id: randomUUID(),
    type: 'reporting.vat_return_created',
    tenant_id: context.tenant_id,
    occurred_at: new Date().toISOString(),
    actor: { user_id: context.user_id },
    data: {
      vat_return_id: returnId,
      period_start,
      period_end,
      net_vat_due: box5NetVatDue,
    },
    schema: 'urn:jobbuilda:events:reporting.vat_return_created:1',
  });

  return {
    success: true,
    vat_return: vatReturn,
  };
}
