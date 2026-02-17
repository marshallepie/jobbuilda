import { AuthContext } from '@jobbuilda/contracts';
import { createClient } from './create-client.js';
import { createSite } from './create-site.js';
import { updateClient } from './update-client.js';
import { updateSite } from './update-site.js';
import { deleteSite } from './delete-site.js';
import { gdprExport } from './gdpr-export.js';
import { gdprDelete } from './gdpr-delete.js';

export const tools = [
  {
    name: 'create_client',
    description: 'Create a new client with GDPR consent tracking',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Client name' },
        email: { type: 'string', format: 'email', description: 'Client email' },
        phone: { type: 'string', description: 'Client phone number' },
        company: { type: 'string', description: 'Company name' },
        notes: { type: 'string', description: 'Additional notes' },
        gdpr_consent: { type: 'boolean', description: 'GDPR consent given' }
      },
      required: ['name']
    }
  },
  {
    name: 'create_site',
    description: 'Create a new job site for a client',
    inputSchema: {
      type: 'object',
      properties: {
        client_id: { type: 'string', format: 'uuid', description: 'Client ID' },
        name: { type: 'string', description: 'Site name' },
        address_line1: { type: 'string', description: 'Address line 1' },
        address_line2: { type: 'string', description: 'Address line 2' },
        city: { type: 'string', description: 'City' },
        county: { type: 'string', description: 'County' },
        postcode: { type: 'string', description: 'Postcode' },
        country: { type: 'string', description: 'Country (default: United Kingdom)' },
        access_notes: { type: 'string', description: 'Access notes for technicians' }
      },
      required: ['client_id', 'name', 'address_line1', 'city', 'postcode']
    }
  },
  {
    name: 'update_client',
    description: 'Update an existing client',
    inputSchema: {
      type: 'object',
      properties: {
        client_id: { type: 'string', format: 'uuid', description: 'Client ID to update' },
        name: { type: 'string', description: 'Client name' },
        email: { type: 'string', format: 'email', description: 'Client email' },
        phone: { type: 'string', description: 'Client phone number' },
        mobile: { type: 'string', description: 'Client mobile number' },
        company: { type: 'string', description: 'Company name' },
        address_line1: { type: 'string', description: 'Address line 1' },
        address_line2: { type: 'string', description: 'Address line 2' },
        city: { type: 'string', description: 'City' },
        county: { type: 'string', description: 'County' },
        postcode: { type: 'string', description: 'Postcode' },
        notes: { type: 'string', description: 'Additional notes' },
        gdpr_consent: { type: 'boolean', description: 'GDPR consent given' }
      },
      required: ['client_id']
    }
  },
  {
    name: 'update_site',
    description: 'Update an existing site',
    inputSchema: {
      type: 'object',
      properties: {
        site_id: { type: 'string', format: 'uuid', description: 'Site ID to update' },
        name: { type: 'string', description: 'Site name' },
        address_line1: { type: 'string', description: 'Address line 1' },
        address_line2: { type: 'string', description: 'Address line 2' },
        city: { type: 'string', description: 'City' },
        county: { type: 'string', description: 'County' },
        postcode: { type: 'string', description: 'Postcode' },
        country: { type: 'string', description: 'Country' },
        contact_name: { type: 'string', description: 'On-site contact name' },
        contact_phone: { type: 'string', description: 'On-site contact phone' },
        access_notes: { type: 'string', description: 'Access notes for technicians' }
      },
      required: ['site_id']
    }
  },
  {
    name: 'delete_site',
    description: 'Delete a site',
    inputSchema: {
      type: 'object',
      properties: {
        site_id: { type: 'string', format: 'uuid', description: 'Site ID to delete' }
      },
      required: ['site_id']
    }
  },
  {
    name: 'gdpr_export',
    description: 'Export all client data for GDPR compliance (Right to Access)',
    inputSchema: {
      type: 'object',
      properties: {
        client_id: { type: 'string', format: 'uuid', description: 'Client ID to export' }
      },
      required: ['client_id']
    }
  },
  {
    name: 'gdpr_delete',
    description: 'Delete all client data for GDPR compliance (Right to Erasure)',
    inputSchema: {
      type: 'object',
      properties: {
        client_id: { type: 'string', format: 'uuid', description: 'Client ID to delete' },
        confirm: { type: 'boolean', description: 'Confirmation flag (must be true)' }
      },
      required: ['client_id', 'confirm']
    }
  }
];

export async function handleToolCall(name: string, args: any): Promise<any> {
  const context: AuthContext = args._meta?.context;
  if (!context) {
    throw new Error('Missing auth context in tool call');
  }

  switch (name) {
    case 'create_client':
      return await createClient(args, context);
    case 'create_site':
      return await createSite(args, context);
    case 'update_client':
      return await updateClient(args, context);
    case 'update_site':
      return await updateSite(args, context);
    case 'delete_site':
      return await deleteSite(args, context);
    case 'gdpr_export':
      return await gdprExport(args, context);
    case 'gdpr_delete':
      return await gdprDelete(args, context);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
