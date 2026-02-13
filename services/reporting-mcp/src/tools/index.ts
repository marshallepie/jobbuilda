import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { generateReport } from './generate-report.js';
import { createVatReturn } from './create-vat-return.js';
import { requestExport } from './request-export.js';

interface AuthContext {
  tenant_id: string;
  user_id: string;
  scopes: string[];
}

export function registerTools(server: Server) {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'generate_report',
          description: 'Generate and cache a financial report',
          inputSchema: {
            type: 'object',
            properties: {
              report_type: {
                type: 'string',
                enum: ['profit_loss', 'invoice_summary', 'payment_summary', 'job_summary'],
                description: 'Type of report to generate',
              },
              period_start: { type: 'string', description: 'Period start date (YYYY-MM-DD)' },
              period_end: { type: 'string', description: 'Period end date (YYYY-MM-DD)' },
              cache_duration_hours: { type: 'number', description: 'Cache duration in hours (default: 24)' },
            },
            required: ['report_type', 'period_start', 'period_end'],
          },
        },
        {
          name: 'create_vat_return',
          description: 'Create an HMRC VAT return (VAT100) for a period',
          inputSchema: {
            type: 'object',
            properties: {
              period_start: { type: 'string', description: 'Period start date (YYYY-MM-DD)' },
              period_end: { type: 'string', description: 'Period end date (YYYY-MM-DD)' },
            },
            required: ['period_start', 'period_end'],
          },
        },
        {
          name: 'request_export',
          description: 'Request an async export (PDF/CSV/XLSX)',
          inputSchema: {
            type: 'object',
            properties: {
              export_type: { type: 'string', description: 'Export type' },
              format: { type: 'string', enum: ['pdf', 'csv', 'xlsx'], description: 'Export format' },
              period_start: { type: 'string', description: 'Period start date' },
              period_end: { type: 'string', description: 'Period end date' },
              filters: { type: 'object', description: 'Additional filters' },
            },
            required: ['export_type', 'format'],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Extract auth context from arguments
    const context = (args as any)?._meta?.context as AuthContext;

    if (!context) {
      throw new Error('Authentication context required');
    }

    try {
      let result;

      switch (name) {
        case 'generate_report':
          result = await generateReport(args as any, context);
          break;

        case 'create_vat_return':
          result = await createVatReturn(args as any, context);
          break;

        case 'request_export':
          result = await requestExport(args as any, context);
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });
}
