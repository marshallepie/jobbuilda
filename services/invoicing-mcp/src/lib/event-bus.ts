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
    name: 'jobs-mcp'
  });

  console.log(`Connected to NATS at ${natsUrl}`);
  return natsConnection;
}

export async function publishEvent(event: BaseEvent): Promise<void> {
  const tracer = trace.getTracer('jobs-mcp');
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
  } catch (error) {
    span.recordException(error as Error);
    console.error('Failed to publish event:', error);
    throw error;
  } finally {
    span.end();
  }
}

// Alias for compatibility
export const publish = publishEvent;

export async function closeNATS(): Promise<void> {
  if (natsConnection) {
    await natsConnection.drain();
    natsConnection = null;
  }
}
