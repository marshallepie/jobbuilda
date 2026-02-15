import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { AuthContext } from '@jobbuilda/contracts';
import { issuePortalToken } from './issue-portal-token.js';
import { checkPermission } from './check-permission.js';
import { updateTenantProfile } from './update-tenant-profile.js';

export const tools = [
  {
    name: 'issue_portal_token',
    description: 'Issue a short-lived JWT token for client portal access (15-60 min TTL)',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', format: 'uuid', description: 'User ID for the token' },
        purpose: {
          type: 'string',
          enum: ['quote_view', 'invoice_payment', 'job_status'],
          description: 'Purpose of the portal token'
        },
        resource_id: { type: 'string', format: 'uuid', description: 'ID of the resource to access' },
        ttl_minutes: {
          type: 'number',
          minimum: 15,
          maximum: 60,
          description: 'Token TTL in minutes (default: 30)'
        }
      },
      required: ['user_id', 'purpose', 'resource_id']
    }
  },
  {
    name: 'check_permission',
    description: 'Check if a user has a specific permission scope',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', format: 'uuid', description: 'User ID to check' },
        scope: { type: 'string', description: 'Permission scope (e.g., "identity:read_users")' }
      },
      required: ['user_id', 'scope']
    }
  },
  {
    name: 'update_tenant_profile',
    description: 'Update business profile information for the tenant',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Company legal name' },
        trading_name: { type: 'string', description: 'Trading name if different' },
        company_number: { type: 'string', description: 'Companies House number' },
        vat_number: { type: 'string', description: 'VAT registration number' },
        address_line1: { type: 'string', description: 'Address line 1' },
        address_line2: { type: 'string', description: 'Address line 2' },
        city: { type: 'string', description: 'City' },
        county: { type: 'string', description: 'County' },
        postcode: { type: 'string', description: 'Postcode' },
        country: { type: 'string', description: 'Country' },
        phone: { type: 'string', description: 'Contact phone' },
        email: { type: 'string', description: 'Contact email' },
        website: { type: 'string', description: 'Website URL' },
        invoice_prefix: { type: 'string', description: 'Invoice number prefix' },
        next_invoice_number: { type: 'number', description: 'Next invoice number' },
        quote_prefix: { type: 'string', description: 'Quote number prefix' },
        next_quote_number: { type: 'number', description: 'Next quote number' },
        bank_name: { type: 'string', description: 'Bank name' },
        account_name: { type: 'string', description: 'Bank account name' },
        sort_code: { type: 'string', description: 'Sort code' },
        account_number: { type: 'string', description: 'Account number' },
        payment_terms: { type: 'string', description: 'Payment terms text' },
        default_vat_rate: { type: 'number', description: 'Default VAT rate percentage' },
        logo_url: { type: 'string', description: 'Logo URL' },
        primary_color: { type: 'string', description: 'Primary brand color (hex)' }
      }
    }
  }
];

export async function handleToolCall(name: string, args: any): Promise<any> {
  // Extract context from _meta
  const context: AuthContext = args._meta?.context;
  if (!context) {
    throw new Error('Missing auth context in tool call');
  }

  switch (name) {
    case 'issue_portal_token':
      return await issuePortalToken(args, context);
    case 'check_permission':
      return await checkPermission(args, context);
    case 'update_tenant_profile':
      return await updateTenantProfile(args, context);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
