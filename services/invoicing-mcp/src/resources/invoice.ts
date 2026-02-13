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
          `SELECT * FROM invoices
          WHERE tenant_id = $1
          ORDER BY invoice_date DESC, created_at DESC`,
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

      throw new Error(`Unknown invoice resource URI: ${uri}`);
    } finally {
      span.end();
    }
  });
}
