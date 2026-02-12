import { JSONSchemaType } from '../../validator';

export interface BaseEvent<T = unknown> {
  id: string;
  type: string;
  tenant_id: string;
  occurred_at: string;
  actor: {
    user_id: string;
  };
  data: T;
  schema: string;
}

// Note: BaseEventSchema omits the `data` property typing since it's generic
export const BaseEventSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    type: { type: 'string' },
    tenant_id: { type: 'string', format: 'uuid' },
    occurred_at: { type: 'string', format: 'date-time' },
    actor: {
      type: 'object',
      properties: {
        user_id: { type: 'string', format: 'uuid' }
      },
      required: ['user_id'],
      additionalProperties: false
    },
    data: { type: 'object' },
    schema: { type: 'string', format: 'uri' }
  },
  required: ['id', 'type', 'tenant_id', 'occurred_at', 'actor', 'data', 'schema'],
  additionalProperties: false
} as const;
