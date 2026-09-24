import { Prisma, PrismaClient } from '@prisma/client';

export type DatabaseClient = PrismaClient;

export interface DatabaseClientOptions {
  /** Explicit pooled database connection URL. Defaults to process.env.DATABASE_URL. */
  databaseUrl?: string;
  /** Whether to log SQL queries and performance timings. */
  logging?: boolean;
}

/**
 * Creates a configured PrismaClient instance.
 *
 * NOTE on Supabase PostgreSQL connections:
 * - Runtime operations (queries, writes, transactions) must use DATABASE_URL, which connects
 *   via Supavisor / PgBouncer connection pooler on port 6543 in transaction pooling mode.
 * - Migration and DDL operations (prisma migrate dev/deploy) must use DIRECT_URL, which connects
 *   directly to PostgreSQL on session port 5432 to support advisory locks and prepared statements.
 */
export function createDatabaseClient(options: DatabaseClientOptions = {}): PrismaClient {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const shouldLog = options.logging ?? isDevelopment;

  const clientOptions: Prisma.PrismaClientOptions = {
    log: shouldLog ? ['query', 'info', 'warn', 'error'] : ['error'],
  };

  if (options.databaseUrl) {
    clientOptions.datasources = {
      db: {
        url: options.databaseUrl,
      },
    };
  }

  return new PrismaClient(clientOptions);
}

// Global client cache to avoid leaking connections in local development hot-reload environments
const globalForPrisma = globalThis as unknown as {
  prismaGlobal?: PrismaClient;
};

/**
 * Shared singleton PrismaClient instance for application runtime.
 */
export const prisma: PrismaClient = globalForPrisma.prismaGlobal ?? createDatabaseClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaGlobal = prisma;
}
