import net from 'node:net';

type Mode = 'forward' | 'refuse' | 'hang';

interface Pair {
  client: net.Socket;
  upstream: net.Socket;
  toUpstream: Buffer[];
  toClient: Buffer[];
}

/**
 * TCP proxy in front of the test Redis, to inject faults without touching Redis itself:
 * `refuse()` drops every connection and closes new ones at once (Redis down), `hang()` keeps
 * connections open but holds every byte (Redis hung), and `restore()` forwards again, including
 * what was held.
 */
export class RedisFaultProxy {
  private readonly server: net.Server;
  private readonly pairs = new Set<Pair>();
  private mode: Mode = 'forward';
  private port = 0;

  constructor(private readonly target: URL) {
    this.server = net.createServer((client) => this.accept(client));
  }

  async start(): Promise<void> {
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    this.port = (this.server.address() as net.AddressInfo).port;
  }

  /** The target URL (credentials and database included), pointed at this proxy. */
  url(): string {
    const url = new URL(this.target.href);
    url.hostname = '127.0.0.1';
    url.port = String(this.port);
    return url.href;
  }

  /** Open client connections. */
  connections(): number {
    return this.pairs.size;
  }

  refuse(): void {
    this.mode = 'refuse';
    for (const pair of this.pairs) this.drop(pair);
  }

  hang(): void {
    this.mode = 'hang';
  }

  restore(): void {
    this.mode = 'forward';
    for (const pair of this.pairs) {
      for (const chunk of pair.toUpstream.splice(0)) pair.upstream.write(chunk);
      for (const chunk of pair.toClient.splice(0)) pair.client.write(chunk);
    }
  }

  async stop(): Promise<void> {
    for (const pair of this.pairs) this.drop(pair);
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private accept(client: net.Socket): void {
    if (this.mode === 'refuse') {
      client.destroy();
      return;
    }
    const upstream = net.connect(Number(this.target.port || 6379), this.target.hostname);
    const pair: Pair = { client, upstream, toUpstream: [], toClient: [] };
    this.pairs.add(pair);
    client.on('data', (chunk: Buffer) => {
      if (this.mode === 'hang') pair.toUpstream.push(chunk);
      else upstream.write(chunk);
    });
    upstream.on('data', (chunk: Buffer) => {
      if (this.mode === 'hang') pair.toClient.push(chunk);
      else client.write(chunk);
    });
    const close = () => this.drop(pair);
    client.on('close', close);
    upstream.on('close', close);
    client.on('error', close);
    upstream.on('error', close);
  }

  private drop(pair: Pair): void {
    if (!this.pairs.delete(pair)) return;
    pair.client.destroy();
    pair.upstream.destroy();
  }
}
