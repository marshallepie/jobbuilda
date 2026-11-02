import { AuthContext } from '@jobbuilda/contracts';
import { getUser } from './user.js';
import { getTenant } from './tenant.js';

export const resources = [
  {
    uri: 'res://identity/users/{id}',
    name: 'User',
    description: 'Get user by ID (tenant-isolated)',
    mimeType: 'application/json'
  },
  {
    uri: 'res://identity/tenants/{id}',
    name: 'Tenant',
    description: 'Get tenant by ID',
    mimeType: 'application/json'
  }
];

export async function handleResourceRead(uri: string, args: any): Promise<any> {
  // Extract context from _meta
  const context: AuthContext = args._meta?.context;
  if (!context) {
    throw new Error('Missing auth context in resource read');
  }

  // Parse URI
  const match = uri.match(/^res:\/\/identity\/(users|tenants)\/([a-f0-9-]+)$/);
  if (!match) {
    throw new Error(`Invalid resource URI: ${uri}`);
  }

  const [, resourceType, id] = match;

  switch (resourceType) {
    case 'users':
      const user = await getUser(id, context.tenant_id);
      if (!user) {
        throw new Error(`User not found: ${id}`);
      }
      return user;

    case 'tenants':
      const tenant = await getTenant(id, context.tenant_id);
      if (!tenant) {
        // A foreign tenant is indistinguishable from an absent tenant.
        throw new Error('Profile not found');
      }
      return tenant;

    default:
      throw new Error(`Unknown resource type: ${resourceType}`);
  }
}
