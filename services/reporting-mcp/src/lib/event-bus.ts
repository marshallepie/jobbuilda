import { connect, NatsConnection, JetStreamClient } from 'nats';
import { trace } from '@opentelemetry/api';
import { query } from './database.js';

const tracer = trace.getTracer('reporting-mcp');

let nc: NatsConnection | null = null;
let js: JetStreamClient | null = null;

export async function initEventBus() {
  const span = tracer.startSpan('event_bus.connect');
  try {
    nc = await connect({
      servers: process.env.NATS_URL || 'nats://localhost:4222',
    });
    js = nc.jetstream();
    console.error('Connected to NATS');
    span.setStatus({ code: 1 });
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({ code: 2, message: (error as Error).message });
  } finally {
    span.end();
  }
}

export async function publish(event: {
  id: string;
  type: string;
  tenant_id: string;
  occurred_at: string;
  actor: { user_id: string };
  data: any;
  schema: string;
}) {
  const span = tracer.startSpan('event_bus.publish');
  span.setAttribute('event.type', event.type);
  span.setAttribute('event.tenant_id', event.tenant_id);

  try {
    // Store in outbox
    await query(
      `INSERT INTO event_outbox (id, event_type, tenant_id, payload)
       VALUES ($1, $2, $3, $4)`,
      [event.id, event.type, event.tenant_id, JSON.stringify(event)]
    );

    // Publish to NATS
    if (js) {
      await js.publish(`events.${event.type}`, JSON.stringify(event));

      // Mark as published
      await query(
        `UPDATE event_outbox SET published_at = NOW() WHERE id = $1`,
        [event.id]
      );
    }

    span.setStatus({ code: 1 });
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({ code: 2, message: (error as Error).message });
  } finally {
    span.end();
  }
}

export async function closeEventBus() {
  if (nc) {
    await nc.close();
    nc = null;
    js = null;
  }
}
