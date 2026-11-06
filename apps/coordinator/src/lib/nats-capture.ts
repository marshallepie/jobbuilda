import { createServer, Server, Socket } from 'node:net';

export type NatsCapture = {
  url: string;
  captures: () => Array<{ subject: string; count: number }>;
  assertHealthy: () => void;
  close: () => Promise<void>;
};

export function isExpectedTeardownSocketError(error: NodeJS.ErrnoException, closing: boolean): boolean {
  return closing && (error.code === 'ECONNRESET' || error.code === 'ECONNABORTED');
}

/** A local, no-consumer NATS protocol capture for rehearsal-only publishes. */
export async function startNatsCapture(): Promise<NatsCapture> {
  const subjects = new Map<string, number>();
  const sockets = new Set<Socket>();
  let closing = false;
  let failure: Error | undefined;

  const recordFailure = (error: unknown): void => {
    if (!failure) failure = error instanceof Error ? error : new Error(String(error));
  };
  const assertHealthy = (): void => {
    if (failure) throw failure;
  };
  const server: Server = createServer((socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
    socket.on('error', (error: NodeJS.ErrnoException) => {
      if (!isExpectedTeardownSocketError(error, closing)) recordFailure(error);
    });
    socket.write('INFO {"server_id":"rehearsal","version":"1.0.0","proto":1,"max_payload":1048576}\r\n');
    let pending = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      try {
        pending = Buffer.concat([pending, chunk]);
        while (pending.length > 0) {
          const end = pending.indexOf('\r\n');
          if (end < 0) return;
          const line = pending.subarray(0, end).toString('utf8');
          if (line === 'PING') {
            socket.write('PONG\r\n');
            pending = pending.subarray(end + 2);
            continue;
          }
          // CONNECT/PING are sufficient for publishers. Reject subscriptions so
          // this rehearsal endpoint can never become an event consumer.
          if (line.startsWith('CONNECT ') || line.startsWith('UNSUB ')) {
            pending = pending.subarray(end + 2);
            continue;
          }
          if (!line.startsWith('PUB ') && !line.startsWith('HPUB ')) {
            throw new Error(`local NATS capture protocol error: unsupported command ${line.split(' ')[0] || '(empty)'}`);
          }
          const parts = line.split(' ');
          const payloadLength = Number(parts.at(-1));
          if (!Number.isSafeInteger(payloadLength) || payloadLength < 0) {
            throw new Error('local NATS capture protocol error: invalid publish payload length');
          }
          const frameLength = end + 2 + payloadLength + 2;
          if (pending.length < frameLength) return;
          if (pending.subarray(frameLength - 2, frameLength).toString('utf8') !== '\r\n') {
            throw new Error('local NATS capture protocol error: publish payload missing terminator');
          }
          const subject = parts[1];
          if (!subject) throw new Error('local NATS capture protocol error: publish subject missing');
          // Capture only sanitized subject/count; payload is never retained.
          subjects.set(subject, (subjects.get(subject) ?? 0) + 1);
          pending = pending.subarray(frameLength);
        }
      } catch (error) {
        recordFailure(error);
        socket.destroy();
      }
    });
  });
  server.on('error', recordFailure);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw new Error('local NATS capture listener did not bind a TCP port');
  }
  return {
    url: `nats://127.0.0.1:${address.port}`,
    captures: () => {
      assertHealthy();
      return [...subjects.entries()].map(([subject, count]) => ({ subject, count }));
    },
    assertHealthy,
    close: async () => {
      closing = true;
      // The capture side explicitly initiates graceful socket closure. Only a
      // reset/aborted error after this point is expected and ignored.
      for (const socket of sockets) socket.end();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      assertHealthy();
    },
  };
}
