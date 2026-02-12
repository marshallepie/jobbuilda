import { AuthContext } from '@jobbuilda/contracts';
import { getClient, listClients } from './client.js';
import { getSite, listSitesByClient } from './site.js';

export const resources = [
  {
    uri: 'res://clients/clients/{id}',
    name: 'Client',
    description: 'Get client by ID (tenant-isolated)',
    mimeType: 'application/json'
  },
  {
    uri: 'res://clients/clients',
    name: 'Clients List',
    description: 'List all clients for tenant',
    mimeType: 'application/json'
  },
  {
    uri: 'res://clients/sites/{id}',
    name: 'Site',
    description: 'Get site by ID (tenant-isolated)',
    mimeType: 'application/json'
  },
  {
    uri: 'res://clients/sites/by-client/{client_id}',
    name: 'Sites by Client',
    description: 'List all sites for a client',
    mimeType: 'application/json'
  }
];

export async function handleResourceRead(uri: string, args: any): Promise<any> {
  const context: AuthContext = args._meta?.context;
  if (!context) {
    throw new Error('Missing auth context in resource read');
  }

  // Parse URI
  const clientMatch = uri.match(/^res:\/\/clients\/clients\/([a-f0-9-]+)$/);
  const clientsListMatch = uri.match(/^res:\/\/clients\/clients$/);
  const siteMatch = uri.match(/^res:\/\/clients\/sites\/([a-f0-9-]+)$/);
  const sitesByClientMatch = uri.match(/^res:\/\/clients\/sites\/by-client\/([a-f0-9-]+)$/);

  if (clientMatch) {
    const [, clientId] = clientMatch;
    const client = await getClient(clientId, context.tenant_id);
    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }
    return client;
  }

  if (clientsListMatch) {
    return await listClients(context.tenant_id);
  }

  if (siteMatch) {
    const [, siteId] = siteMatch;
    const site = await getSite(siteId, context.tenant_id);
    if (!site) {
      throw new Error(`Site not found: ${siteId}`);
    }
    return site;
  }

  if (sitesByClientMatch) {
    const [, clientId] = sitesByClientMatch;
    return await listSitesByClient(clientId, context.tenant_id);
  }

  throw new Error(`Invalid resource URI: ${uri}`);
}
