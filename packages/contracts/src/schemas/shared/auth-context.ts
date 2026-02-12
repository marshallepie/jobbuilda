import { JSONSchemaType } from '../../validator';

export interface AuthContext {
  tenant_id: string;
  user_id: string;
  scopes: string[];
  x_request_id: string;
}

export const AuthContextSchema: JSONSchemaType<AuthContext> = {
  type: 'object',
  properties: {
    tenant_id: { type: 'string', format: 'uuid' },
    user_id: { type: 'string', format: 'uuid' },
    scopes: {
      type: 'array',
      items: { type: 'string' }
    },
    x_request_id: { type: 'string' }
  },
  required: ['tenant_id', 'user_id', 'scopes', 'x_request_id'],
  additionalProperties: false
};
