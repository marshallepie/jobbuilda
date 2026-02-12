import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { AuthContext, IssuePortalTokenInput, PortalTokenPayload } from '@jobbuilda/contracts';
import { trace } from '@opentelemetry/api';
import { publish } from '../lib/event-bus.js';

export async function issuePortalToken(
  input: IssuePortalTokenInput,
  context: AuthContext
): Promise<{ token: string; expires_at: string }> {
  const tracer = trace.getTracer('identity-mcp');
  const span = tracer.startSpan('tool.issue_portal_token');

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const ttlMinutes = input.ttl_minutes || 30;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const payload: PortalTokenPayload = {
      tenant_id: context.tenant_id,
      user_id: input.user_id,
      purpose: input.purpose,
      resource_id: input.resource_id,
      expires_at: expiresAt.toISOString()
    };

    const token = jwt.sign(payload, jwtSecret, {
      expiresIn: `${ttlMinutes}m`,
      issuer: 'jobbuilda-identity-mcp',
      subject: input.user_id
    });

    // Publish event
    await publish({
      id: randomUUID(),
      type: 'identity.portal_token_issued',
      tenant_id: context.tenant_id,
      occurred_at: new Date().toISOString(),
      actor: { user_id: context.user_id },
      data: {
        token_user_id: input.user_id,
        purpose: input.purpose,
        resource_id: input.resource_id,
        expires_at: expiresAt.toISOString()
      },
      schema: 'urn:jobbuilda:events:identity.portal_token_issued:1'
    });

    span.setAttribute('token.purpose', input.purpose);
    span.setAttribute('token.ttl_minutes', ttlMinutes);

    return {
      token,
      expires_at: expiresAt.toISOString()
    };
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
