import { query } from '../lib/database.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';

const tracer = trace.getTracer('invoicing-mcp');

function computeInvoiceTotals(invoices: any[]) {
  return invoices.reduce(
    (acc, i) => ({
      total_invoiced: acc.total_invoiced + parseFloat(i.total_inc_vat || 0),
      total_paid: acc.total_paid + parseFloat(i.amount_paid || 0),
      total_outstanding: acc.total_outstanding + parseFloat(i.amount_due || 0),
    }),
    { total_invoiced: 0, total_paid: 0, total_outstanding: 0 }
  );
}

export async function handleInvoiceResource(
  uri: string,
  context: AuthContext
): Promise<any> {
  return tracer.startActiveSpan('resource.invoice', async (span) => {
    try {
      span.setAttributes({
        'resource.uri': uri,
        'tenant.id': context.tenant_id,
      });

      // List all invoices: res://invoicing/invoices
      if (uri === 'res://invoicing/invoices') {
        const result = await query(
          `SELECT i.*, c.name AS client_name
          FROM invoices i
          LEFT JOIN clients c ON c.id = i.client_id
          WHERE i.tenant_id = $1
          ORDER BY i.invoice_date DESC, i.created_at DESC`,
          [context.tenant_id]
        );

        return {
          data: result.rows,
          _meta: { context },
        };
      }

      // Get single invoice: res://invoicing/invoices/{id}
      const invoiceMatch = uri.match(/^res:\/\/invoicing\/invoices\/([a-f0-9-]+)$/);
      if (invoiceMatch) {
        const invoiceId = invoiceMatch[1];

        const invoiceResult = await query(
          `SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2`,
          [invoiceId, context.tenant_id]
        );

        if (invoiceResult.rows.length === 0) {
          throw new Error('Invoice not found');
        }

        const itemsResult = await query(
          `SELECT * FROM invoice_items
          WHERE invoice_id = $1 AND tenant_id = $2
          ORDER BY created_at`,
          [invoiceId, context.tenant_id]
        );

        return {
          data: {
            ...invoiceResult.rows[0],
            items: itemsResult.rows,
          },
          _meta: { context },
        };
      }

      // Get invoices for a job: res://invoicing/job-invoices/{job_id}
      const jobMatch = uri.match(/^res:\/\/invoicing\/job-invoices\/([a-f0-9-]+)$/);
      if (jobMatch) {
        const jobId = jobMatch[1];

        const result = await query(
          `SELECT * FROM invoices
          WHERE job_id = $1 AND tenant_id = $2
          ORDER BY invoice_date DESC`,
          [jobId, context.tenant_id]
        );

        const rows = result.rows;
        const totals = computeInvoiceTotals(rows);

        return {
          data: {
            job_id: jobId,
            invoices: rows,
            summary: {
              total_invoices: rows.length,
              draft: rows.filter(i => i.status === 'draft').length,
              sent: rows.filter(i => i.status === 'sent').length,
              paid: rows.filter(i => i.status === 'paid').length,
              overdue: rows.filter(i => i.status === 'overdue').length,
              total_value: totals.total_invoiced,
              total_paid: totals.total_paid,
              total_outstanding: totals.total_outstanding,
            },
          },
          _meta: { context },
        };
      }

      const quoteMatch = uri.match(/^res:\/\/invoicing\/quote-invoices\/([a-f0-9-]+)$/);
      if (quoteMatch) {
        const quoteId = quoteMatch[1];

        const result = await query(
          `SELECT id, invoice_number, invoice_type, invoice_date, due_date, status,
                  subtotal_ex_vat, vat_amount, total_inc_vat, amount_paid, amount_due
           FROM invoices
           WHERE quote_id = $1 AND tenant_id = $2
             AND status NOT IN ('cancelled', 'void')
           ORDER BY invoice_date ASC, created_at ASC`,
          [quoteId, context.tenant_id]
        );

        const invoices = result.rows;
        const { total_invoiced, total_paid, total_outstanding } = computeInvoiceTotals(invoices);

        return {
          data: {
            quote_id: quoteId,
            invoices,
            summary: {
              total_invoices: invoices.length,
              total_invoiced: Math.round(total_invoiced * 100) / 100,
              total_paid: Math.round(total_paid * 100) / 100,
              total_outstanding: Math.round(total_outstanding * 100) / 100,
            },
          },
          _meta: { context },
        };
      }

      throw new Error(`Unknown invoice resource URI: ${uri}`);
    } finally {
      span.end();
    }
  });
}
