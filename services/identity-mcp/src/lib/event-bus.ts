import { connect, NatsConnection, StringCodec } from 'nats';
import { BaseEvent } from '@jobbuilda/contracts';
import { trace } from '@opentelemetry/api';

let natsConnection: NatsConnection | null = null;
const sc = StringCodec();

export async function connectToNATS(): Promise<NatsConnection> {
  if (natsConnection) {
    return natsConnection;
  }

  const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
  natsConnection = await connect({
    servers: natsUrl,
    name: 'identity-mcp'
  });

  console.log(`Connected to NATS at ${natsUrl}`);
  return natsConnection;
}

export async function publish(event: BaseEvent): Promise<void> {
  const tracer = trace.getTracer('identity-mcp');
  const span = tracer.startSpan('event.publish', {
    attributes: {
      'event.type': event.type,
      'event.tenant_id': event.tenant_id
    }
  });

  try {
    const nc = await connectToNATS();
    const subject = `events.${event.type}`;
    const payload = sc.encode(JSON.stringify(event));

    await nc.publish(subject, payload);
    span.setAttribute('event.subject', subject);

    console.log(`Published event: ${event.type} (${event.id})`);
  } catch (error: any) {
    span.recordException(error as Error);
    console.warn('Failed to publish event (NATS unavailable):', error.message);
    // Don't throw - allow operation to continue without event publishing for MVP
  } finally {
    span.end();
  }
}

export async function closeNATS(): Promise<void> {
  if (natsConnection) {
    await natsConnection.drain();
    natsConnection = null;
  }
}
