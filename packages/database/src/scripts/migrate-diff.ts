import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env if process.env.DATABASE_URL is not yet defined
if (!process.env.DATABASE_URL) {
  const rootEnv = resolve(process.cwd(), '../../.env');
  const localEnv = resolve(process.cwd(), '.env');
  const envPath = existsSync(localEnv) ? localEnv : existsSync(rootEnv) ? rootEnv : null;

  if (envPath) {
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed
          .slice(idx + 1)
          .trim()
          .replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ Error: DATABASE_URL must be defined to run prisma migrate diff.');
  process.exit(1);
}

const shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL || databaseUrl;

const cmd = [
  'prisma migrate diff',
  '--from-schema-datamodel prisma/schema.prisma',
  '--to-migrations prisma/migrations',
  `--shadow-database-url "${shadowDatabaseUrl}"`,
  '--exit-code',
].join(' ');

try {
  execSync(cmd, { stdio: 'inherit' });
} catch (error: unknown) {
  const status = (error as { status?: number }).status ?? 1;
  process.exit(status);
}
