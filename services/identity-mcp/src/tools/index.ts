import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { AuthContext } from '@jobbuilda/contracts';
import { issuePortalToken } from './issue-portal-token.js';
import { checkPermission } from './check-permission.js';

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
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
