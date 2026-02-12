import { JSONSchemaType } from '../../validator';

export type TenantPlan = 'trial' | 'standard' | 'premium';

export interface Tenant {
  id: string;
  name: string;
  plan: TenantPlan;
  created_at: string;
  updated_at: string;
}

export const TenantSchema: JSONSchemaType<Tenant> = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    plan: { type: 'string', enum: ['trial', 'standard', 'premium'] },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' }
  },
  required: ['id', 'name', 'plan', 'created_at', 'updated_at'],
  additionalProperties: false
};
