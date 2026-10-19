import net, { type AddressInfo } from 'node:net';

/**
 * A TCP relay to a local service that a spec can take down and bring back on the same port:
 * the way to put a Redis outage and its recovery under a test's control without touching the
 * Redis itself.
 */
export interface TcpProxy {
  readonly port: number;
  /** Drops every open connection and stops accepting new ones. */
  down(): Promise<void>;
  /** Accepts connections again, on the same port. */
  up(): Promise<void>;
}

export async function startTcpProxy(target: { host: string; port: number }): Promise<TcpProxy> {
  const sockets = new Set<net.Socket>();
  let server: net.Server | null = null;
  let port = 0;

  const listen = () =>
    new Promise<void>((resolve, reject) => {
      const next = net.createServer((client) => {
        const upstream = net.connect(target.port, target.host);
        const drop = () => {
          client.destroy();
          upstream.destroy();
          sockets.delete(client);
          sockets.delete(upstream);
        };
        sockets.add(client);
        sockets.add(upstream);
        client.on('error', drop).on('close', drop);
        upstream.on('error', drop).on('close', drop);
        client.pipe(upstream).pipe(client);
      });
      next.once('error', reject);
      next.listen(port, '127.0.0.1', () => {
        port = (next.address() as AddressInfo).port;
        server = next;
        resolve();
      });
    });

  await listen();
  return {
    get port() {
      return port;
    },
    async down() {
      for (const socket of sockets) socket.destroy();
      sockets.clear();
      const closing = server;
      server = null;
      if (closing) await new Promise<void>((resolve) => closing.close(() => resolve()));
    },
    up: listen,
  };
}
