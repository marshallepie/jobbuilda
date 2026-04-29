import { query } from '../lib/database.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';

const tracer = trace.getTracer('invoicing-mcp');

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

        return {
          data: {
            job_id: jobId,
            invoices: result.rows,
            summary: {
              total_invoices: result.rows.length,
              draft: result.rows.filter(i => i.status === 'draft').length,
              sent: result.rows.filter(i => i.status === 'sent').length,
              paid: result.rows.filter(i => i.status === 'paid').length,
              overdue: result.rows.filter(i => i.status === 'overdue').length,
              total_value: result.rows.reduce((sum, i) => sum + parseFloat(i.total_inc_vat || 0), 0),
              total_paid: result.rows.reduce((sum, i) => sum + parseFloat(i.amount_paid || 0), 0),
              total_outstanding: result.rows.reduce((sum, i) => sum + parseFloat(i.amount_due || 0), 0),
            },
          },
          _meta: { context },
        };
      }

      // Get invoices for a quote + balance ledger: res://invoicing/quote-invoices/{quote_id}
      // Returns all invoices linked to a quote plus a running balance against the quote total.
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
        const totalInvoiced = invoices.reduce((sum, i) => sum + parseFloat(i.total_inc_vat || 0), 0);
        const totalPaid = invoices.reduce((sum, i) => sum + parseFloat(i.amount_paid || 0), 0);
        const totalOutstanding = invoices.reduce((sum, i) => sum + parseFloat(i.amount_due || 0), 0);

        return {
          data: {
            quote_id: quoteId,
            invoices,
            summary: {
              total_invoices: invoices.length,
              total_invoiced: Math.round(totalInvoiced * 100) / 100,
              total_paid: Math.round(totalPaid * 100) / 100,
              total_outstanding: Math.round(totalOutstanding * 100) / 100,
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
