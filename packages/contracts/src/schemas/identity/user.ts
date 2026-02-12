import { JSONSchemaType } from '../../validator';

export type UserRole = 'admin' | 'technician' | 'client';

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export const UserSchema: JSONSchemaType<User> = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    tenant_id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    name: { type: 'string' },
    role: { type: 'string', enum: ['admin', 'technician', 'client'] },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' }
  },
  required: ['id', 'tenant_id', 'email', 'name', 'role', 'created_at', 'updated_at'],
  additionalProperties: false
};
