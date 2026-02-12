import { JSONSchemaType } from '../../validator';

export interface PortalTokenPayload {
  tenant_id: string;
  user_id: string;
  purpose: 'quote_view' | 'invoice_payment' | 'job_status';
  resource_id: string;
  expires_at: string;
}

export const PortalTokenPayloadSchema: JSONSchemaType<PortalTokenPayload> = {
  type: 'object',
  properties: {
    tenant_id: { type: 'string', format: 'uuid' },
    user_id: { type: 'string', format: 'uuid' },
    purpose: { type: 'string', enum: ['quote_view', 'invoice_payment', 'job_status'] },
    resource_id: { type: 'string', format: 'uuid' },
    expires_at: { type: 'string', format: 'date-time' }
  },
  required: ['tenant_id', 'user_id', 'purpose', 'resource_id', 'expires_at'],
  additionalProperties: false
};

export interface IssuePortalTokenInput {
  user_id: string;
  purpose: PortalTokenPayload['purpose'];
  resource_id: string;
  ttl_minutes?: number;
}

export const IssuePortalTokenInputSchema: JSONSchemaType<IssuePortalTokenInput> = {
  type: 'object',
  properties: {
    user_id: { type: 'string', format: 'uuid' },
    purpose: { type: 'string', enum: ['quote_view', 'invoice_payment', 'job_status'] },
    resource_id: { type: 'string', format: 'uuid' },
    ttl_minutes: { type: 'number', minimum: 15, maximum: 60, nullable: true }
  },
  required: ['user_id', 'purpose', 'resource_id'],
  additionalProperties: false
};
