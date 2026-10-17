// Isolation guard for the WU-01 compose smoke (VYN-01-03).
//
// compose-smoke.sh renders the final compose config (docker-compose.yml + compose.smoke.yml)
// and runs this file with plain `node` before it changes any Docker or database state;
// infra:verify imports it for the static checks and its negative tests. Keep it to Node
// built-ins and erasable TypeScript so Node can run it without a build step.
//
//   node compose-smoke-guard.mts config <rendered.json> <repo root> <smoke.env>
//   node compose-smoke-guard.mts db-url <database url> <smoke postgres port>
//
// Both commands print every problem and exit 1 when there is at least one.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SMOKE_PROJECT = 'vynor-wu01-smoke';
export const LIVE_PROJECT = 'vynor-crm';
export const SMOKE_DATABASE = 'vynor_test';

const LIVE_DATABASES = ['vynor', 'vynor_crm'];
const LIVE_VOLUME = 'vynor-crm_postgres_data';
const EXPECTED_SERVICES = ['api', 'caddy', 'postgres', 'rustfs', 'rustfs-init', 'web', 'worker'];
// Service DNS names inside the smoke network, plus loopback for URLs the browser would use.
const INTERNAL_HOSTS = new Set(['localhost', '127.0.0.1', 'postgres', 'rustfs', 'api', 'web']);
// The dev placeholders committed in docker-compose.yml. Any other value in a secret-like
// variable means a real secret reached the smoke config (for example from the shell).
const ALLOWED_SECRET_VALUES = new Set([
  '',
  'postgres',
  'vynor_storage_admin',
  'vynor_storage_secret',
  'dev-anon-key-placeholder',
  'dev-service-role-key-placeholder',
  'dev-supabase-jwt-secret-for-local-testing-only-32-chars',
]);
const SECRET_NAME = /SECRET|PASSWORD|TOKEN|KEY/;
const URL_TOKEN = /[a-z][a-z0-9+.-]*:\/\/[^\s,'"]+/gi;

interface ComposePort {
  host_ip?: string;
  published?: string;
  target: number;
}

interface ComposeMount {
  type: string;
  source?: string;
  target: string;
  read_only?: boolean;
}

interface ComposeService {
  container_name?: string;
  restart?: string;
  image?: string;
  build?: { context?: string; dockerfile?: string };
  environment?: Record<string, string | null>;
  ports?: ComposePort[];
  volumes?: ComposeMount[];
  healthcheck?: { test?: string[] };
  entrypoint?: string[] | null;
  command?: string[] | null;
}

export interface ComposeConfig {
  name?: string;
  services?: Record<string, ComposeService>;
  volumes?: Record<string, { name?: string; external?: boolean }>;
  networks?: Record<string, { name?: string; external?: boolean }>;
}

/** Host ports declared in smoke.env (SMOKE_*_PORT=<port>). */
export function readSmokePorts(envFileText: string): Map<string, string> {
  const ports = new Map<string, string>();
  for (const line of envFileText.split('\n')) {
    const match = /^(SMOKE_[A-Z_]+_PORT)=(\d+)\s*$/.exec(line.trim());
    if (match) ports.set(match[1], match[2]);
  }
  return ports;
}

/** Problems with a PostgreSQL URL the runner is about to migrate or seed from the host. */
export function checkHostDatabaseUrl(url: string, smokePostgresPort: string): string[] {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return [`database URL does not parse: ${redact(url)}`];
  }
  const problems: string[] = [];
  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    problems.push(`database URL must use postgresql://, got ${parsed.protocol}`);
  }
  // Checking the port, not only the name: the live instance on 5434 also holds a vynor_test.
  if (parsed.hostname !== '127.0.0.1') {
    problems.push(`database host must be 127.0.0.1, got ${parsed.hostname}`);
  }
  if (!/^\d+$/.test(smokePostgresPort) || parsed.port !== smokePostgresPort) {
    problems.push(`database port must be the smoke port ${smokePostgresPort}, got ${parsed.port}`);
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (database !== SMOKE_DATABASE) {
    problems.push(`database must be ${SMOKE_DATABASE}, got ${database || '(none)'}`);
  }
  return problems;
}

/** Problems that make the rendered smoke config unsafe to start next to the live stack. */
export function checkSmokeConfig(
  config: ComposeConfig,
  repoRoot: string,
  smokePorts: Map<string, string>,
): string[] {
  const problems: string[] = [];
  const services = config.services ?? {};

  if (config.name !== SMOKE_PROJECT) {
    problems.push(`project name must be ${SMOKE_PROJECT}, got ${config.name ?? '(none)'}`);
  }
  const names = Object.keys(services).sort();
  if (names.join(',') !== EXPECTED_SERVICES.join(',')) {
    problems.push(`services must be ${EXPECTED_SERVICES.join(', ')}, got ${names.join(', ')}`);
  }

  const allowedPorts = new Set(smokePorts.values());
  const publishedPorts: string[] = [];
  const allowedBind = path.join(repoRoot, 'infrastructure/caddy/Caddyfile');

  for (const [name, service] of Object.entries(services)) {
    if (service.container_name) {
      problems.push(`${name}: container_name ${service.container_name} must be reset`);
    }
    if (service.restart !== undefined && service.restart !== 'no') {
      problems.push(`${name}: restart must be "no", got ${service.restart}`);
    }
    for (const port of service.ports ?? []) {
      publishedPorts.push(port.published ?? '');
      if (port.host_ip !== '127.0.0.1') {
        problems.push(
          `${name}: port ${port.target} must bind 127.0.0.1, got ${port.host_ip ?? 'all'}`,
        );
      }
      if (!port.published || !allowedPorts.has(port.published)) {
        problems.push(
          `${name}: published port ${port.published ?? '(random)'} is not in smoke.env`,
        );
      }
    }
    for (const mount of service.volumes ?? []) {
      if (mount.type === 'volume') {
        if (!mount.source || !(mount.source in (config.volumes ?? {}))) {
          problems.push(`${name}: volume ${mount.source ?? '(anonymous)'} is not a project volume`);
        }
      } else if (mount.type === 'bind') {
        if (mount.source !== allowedBind || mount.read_only !== true) {
          problems.push(`${name}: bind mount ${mount.source} is not allowed`);
        }
      } else {
        problems.push(`${name}: mount type ${mount.type} is not allowed`);
      }
    }
    if (service.build) {
      if (service.build.context !== repoRoot) {
        problems.push(`${name}: build context must be ${repoRoot}, got ${service.build.context}`);
      }
      if (!service.build.dockerfile?.startsWith('infrastructure/docker/Dockerfile.')) {
        problems.push(`${name}: Dockerfile must live in infrastructure/docker (DEC-08)`);
      }
      if (service.image && !service.image.startsWith(`${SMOKE_PROJECT}-`)) {
        problems.push(`${name}: built image ${service.image} must carry the smoke prefix`);
      }
    }
    for (const [key, value] of Object.entries(service.environment ?? {})) {
      const text = value ?? '';
      if (SECRET_NAME.test(key) && !ALLOWED_SECRET_VALUES.has(text)) {
        problems.push(`${name}: ${key} holds a value that is not a committed dev placeholder`);
      }
    }
    const texts = [
      ...Object.values(service.environment ?? {}).map((value) => value ?? ''),
      ...(service.healthcheck?.test ?? []),
      ...(service.entrypoint ?? []),
      ...(service.command ?? []),
    ];
    for (const text of texts) {
      for (const token of text.match(URL_TOKEN) ?? []) {
        problems.push(...checkServiceUrl(name, token));
      }
    }
  }

  const postgres = services.postgres;
  if (postgres?.environment?.POSTGRES_DB !== SMOKE_DATABASE) {
    problems.push(`postgres: POSTGRES_DB must be ${SMOKE_DATABASE}`);
  }
  if (!postgres?.healthcheck?.test?.join(' ').includes(`-d ${SMOKE_DATABASE}`)) {
    problems.push(`postgres: health check must probe ${SMOKE_DATABASE}`);
  }
  for (const name of ['api', 'worker']) {
    for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
      if (!services[name]?.environment?.[key]) problems.push(`${name}: ${key} must be set`);
    }
  }

  const missingPorts = [...allowedPorts].filter((port) => !publishedPorts.includes(port));
  if (missingPorts.length > 0 || publishedPorts.length !== new Set(publishedPorts).size) {
    problems.push(
      `published ports must use each smoke.env port once, got ${publishedPorts.join(', ')}`,
    );
  }

  for (const [kind, entries] of [
    ['volume', config.volumes ?? {}],
    ['network', config.networks ?? {}],
  ] as const) {
    for (const [key, entry] of Object.entries(entries)) {
      if (entry.external) problems.push(`${kind} ${key} must not be external`);
      if (!entry.name?.startsWith(`${SMOKE_PROJECT}_`)) {
        problems.push(`${kind} ${key} must be named ${SMOKE_PROJECT}_*, got ${entry.name}`);
      }
    }
  }

  // Last line of defence: nothing in the rendered config may name live resources.
  const rendered = JSON.stringify(config);
  if (rendered.includes(LIVE_VOLUME)) problems.push(`config references ${LIVE_VOLUME}`);
  if (rendered.includes(`${LIVE_PROJECT}_`)) {
    problems.push(`config references ${LIVE_PROJECT}_* resources`);
  }
  return problems;
}

function checkServiceUrl(service: string, token: string): string[] {
  let parsed: URL;
  try {
    parsed = new URL(token);
  } catch {
    return [`${service}: URL does not parse: ${redact(token)}`];
  }
  const problems: string[] = [];
  if (!INTERNAL_HOSTS.has(parsed.hostname)) {
    problems.push(`${service}: URL host ${parsed.hostname} is outside the smoke stack`);
  }
  if (parsed.protocol === 'postgresql:' || parsed.protocol === 'postgres:') {
    const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    if (parsed.hostname !== 'postgres' || (parsed.port !== '' && parsed.port !== '5432')) {
      problems.push(`${service}: database URL must target postgres:5432 inside the smoke network`);
    }
    if (database !== SMOKE_DATABASE || LIVE_DATABASES.includes(database)) {
      problems.push(`${service}: database URL must use ${SMOKE_DATABASE}, got ${database}`);
    }
  }
  return problems;
}

function redact(url: string): string {
  return url.replace(/\/\/[^@/]*@/, '//***@');
}

function main(argv: string[]): number {
  const [command, ...args] = argv;
  let problems: string[];
  if (command === 'config' && args.length === 3) {
    const [renderedPath, repoRoot, envFile] = args;
    const config = JSON.parse(fs.readFileSync(renderedPath, 'utf8')) as ComposeConfig;
    const ports = readSmokePorts(fs.readFileSync(envFile, 'utf8'));
    problems = checkSmokeConfig(config, repoRoot, ports);
  } else if (command === 'db-url' && args.length === 2) {
    problems = checkHostDatabaseUrl(args[0], args[1]);
  } else {
    console.error('usage: compose-smoke-guard.mts config <rendered.json> <repo root> <smoke.env>');
    console.error('       compose-smoke-guard.mts db-url <database url> <smoke postgres port>');
    return 2;
  }
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  if (problems.length === 0) console.info(`  ✓ ${command}: no isolation problems`);
  return problems.length === 0 ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
