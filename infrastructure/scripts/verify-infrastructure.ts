import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  checkHostDatabaseUrl,
  checkSmokeConfig,
  readSmokePorts,
  SMOKE_PROJECT,
  type ComposeConfig,
} from './compose-smoke-guard.mts';

console.info('======================================================');
console.info('  VYNOR CRM Infrastructure & DevOps Verification (6.4)');
console.info('======================================================');

const rootDir = process.cwd();
const smokeEnvFile = path.join(rootDir, 'infrastructure/docker/smoke.env');
const smokeOverlay = path.join(rootDir, 'infrastructure/docker/compose.smoke.yml');

// DEC-08: compose at the repository root, Dockerfiles only in infrastructure/docker.
const DOCKERFILES = {
  api: 'infrastructure/docker/Dockerfile.api',
  worker: 'infrastructure/docker/Dockerfile.worker',
  web: 'infrastructure/docker/Dockerfile.web',
};
const REMOVED_DUPLICATES = [
  'apps/api/Dockerfile',
  'apps/worker/Dockerfile',
  'apps/web/Dockerfile',
  'infrastructure/docker/docker-compose.yml',
];
// NF-08: MinIO stopped publishing images; the owner chose PGSTY Silo. Tag and multi-arch index
// digest were verified against Docker Hub (see docs/migration/08 log, WU-01 stage 2).
const STORAGE_IMAGE =
  'docker.io/pgsty/silo:RELEASE.2026-10-15T00-00-00Z@sha256:aaac6bce13eb99316b3c88bd20143fc3c38ab607585256a411a095c44ee57f62';
const STORAGE_BUCKETS = ['vynor-crm-attachments', 'vynor-crm-attachments-quarantine'];
const CADDY_INTERNAL_ROOT = '/data/caddy/pki/authorities/local/root.crt';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf-8');
}

/**
 * Renders compose under the explicit smoke project name with a sanitized environment, so shell
 * variables (COMPOSE_PROJECT_NAME, POSTGRES_PORT, ...) cannot change the result. `config` only
 * renders; it never creates, starts or removes anything.
 */
function renderCompose(files: string[]): ComposeConfig {
  const args = ['compose', '--project-name', SMOKE_PROJECT, '--project-directory', rootDir];
  args.push('--env-file', smokeEnvFile, ...files.flatMap((file) => ['-f', file]));
  const output = execFileSync('docker', [...args, 'config', '--format', 'json'], {
    cwd: rootDir,
    encoding: 'utf-8',
    env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' },
  });
  return JSON.parse(output) as ComposeConfig;
}

let defaultConfig: ComposeConfig | undefined;
/** The services of docker-compose.yml alone (the default stack), rendered once. */
function defaultServices(): NonNullable<ComposeConfig['services']> {
  defaultConfig ??= renderCompose(['docker-compose.yml']);
  return defaultConfig.services ?? {};
}

/** Health probe paths the API really serves: global prefix + @Controller + @Get(liveness). */
function apiLivenessPaths(): Set<string> {
  const prefix = /setGlobalPrefix\('([^']+)'\)/.exec(read('apps/api/src/main.ts'))?.[1];
  const controller = read('apps/api/src/health/health.controller.ts');
  const base = /@Controller\('([^']+)'\)/.exec(controller)?.[1];
  const routes = /@Get\(\[([^\]]+)\]\)\s*getLiveness/.exec(controller)?.[1];
  assert.ok(prefix && base && routes, 'could not derive the API liveness routes from the source');
  const names = routes.split(',').map((route) => route.trim().replace(/^'|'$/g, ''));
  return new Set(names.map((name) => `/${prefix}/${base}/${name}`));
}

/** Problems with the probe URLs in a health check command (API container or Caddy). */
function probeProblems(
  label: string,
  command: string,
  validPaths: Set<string>,
  options: { https: boolean },
): string[] {
  const urls = [...command.matchAll(/(https?):\/\/localhost(?::\d+)?(\/[^\s'"|]*)/g)];
  if (urls.length === 0) return [`${label}: no probe URL found in "${command}"`];
  const problems: string[] = [];
  for (const [url, scheme, probePath] of urls) {
    if (!validPaths.has(probePath)) {
      problems.push(
        `${label}: ${url} is not an API liveness route (${[...validPaths].join(', ')})`,
      );
    }
    if (options.https && scheme !== 'https') {
      problems.push(`${label}: ${url} must use HTTPS (Caddy has no HTTP listener)`);
    }
  }
  if (/--no-check-certificate|--insecure|\s-k\b/.test(command)) {
    problems.push(`${label}: TLS verification must stay on`);
  }
  if (options.https && !command.includes(`SSL_CERT_FILE=${CADDY_INTERNAL_ROOT}`)) {
    problems.push(`${label}: must verify against the Caddy internal root CA`);
  }
  return problems;
}

let checkCount = 0;
function check(name: string, fn: () => void) {
  checkCount++;
  try {
    fn();
    console.info(`  ✓ [Check ${checkCount}] ${name}`);
  } catch (err) {
    console.error(`  ✗ [Check ${checkCount}] FAILED: ${name}`);
    throw err;
  }
}

// 1. Dockerfiles & Non-Root Users (FND-INF-001)
check('Dockerfiles exist for web, api, and worker in infrastructure/docker only (DEC-08)', () => {
  for (const df of Object.values(DOCKERFILES)) {
    assert.ok(fs.existsSync(path.join(rootDir, df)), `Dockerfile missing at ${df}`);
  }
  for (const duplicate of REMOVED_DUPLICATES) {
    assert.ok(!fs.existsSync(path.join(rootDir, duplicate)), `${duplicate} must not come back`);
  }
});

check('Dockerfiles enforce multi-stage builds and non-root runtime users (UID 1001)', () => {
  for (const target of Object.values(DOCKERFILES)) {
    const content = fs.readFileSync(path.join(rootDir, target), 'utf-8');
    assert.ok(
      content.includes('FROM') && content.includes('AS base'),
      `${target} must have multi-stage base`,
    );
    assert.ok(content.includes('AS runner'), `${target} must have runner stage`);
    assert.ok(content.includes('1001'), `${target} must define non-root UID 1001`);
    assert.ok(content.includes('USER '), `${target} must switch to non-root USER`);
  }
});

check('.dockerignore exists and excludes build artifacts & node_modules', () => {
  const dockerignore = fs.readFileSync(path.join(rootDir, '.dockerignore'), 'utf-8');
  assert.ok(dockerignore.includes('node_modules'), '.dockerignore must exclude node_modules');
  assert.ok(dockerignore.includes('.git'), '.dockerignore must exclude .git');
  assert.ok(dockerignore.includes('.next'), '.dockerignore must exclude .next');
});

// 2. Docker Compose Topology & Health Checks (FND-INF-002, FND-INF-005)
check('docker-compose.yml exists and defines all required services', () => {
  const composePath = path.join(rootDir, 'docker-compose.yml');
  assert.ok(fs.existsSync(composePath), 'docker-compose.yml must exist at repo root');
  const content = fs.readFileSync(composePath, 'utf-8');

  const requiredServices = [
    'postgres:',
    'rustfs:',
    'rustfs-init:',
    'api:',
    'worker:',
    'web:',
    'caddy:',
  ];
  for (const svc of requiredServices) {
    assert.ok(content.includes(svc), `docker-compose.yml must define ${svc}`);
  }
});

check(
  'docker-compose.yml uses explicit health checks and condition: service_healthy (zero arbitrary sleeps)',
  () => {
    const content = fs.readFileSync(path.join(rootDir, 'docker-compose.yml'), 'utf-8');
    assert.ok(content.includes('healthcheck:'), 'docker-compose.yml must define health checks');
    assert.ok(
      content.includes('condition: service_healthy'),
      'docker-compose.yml must use condition: service_healthy',
    );
    assert.ok(
      !content.includes('sleep 10'),
      'docker-compose.yml must not use arbitrary sleep commands',
    );
  },
);

check('worker health checks read the worker heartbeat instead of always passing', () => {
  for (const target of [DOCKERFILES.worker, 'docker-compose.yml']) {
    const content = fs.readFileSync(path.join(rootDir, target), 'utf-8');
    assert.ok(
      content.includes('node apps/worker/dist/healthcheck.js'),
      `${target} must check the worker with apps/worker/dist/healthcheck.js`,
    );
    assert.ok(
      !content.includes('process.exit(0)'),
      `${target} must not use a health check that always passes`,
    );
  }
});

check('docker compose config renders and builds from infrastructure/docker (DEC-08)', () => {
  for (const [name, dockerfile] of Object.entries(DOCKERFILES)) {
    const built = defaultServices()[name]?.build?.dockerfile;
    assert.equal(built, dockerfile, `${name} must build ${dockerfile}`);
  }
  const workflow = read('.github/workflows/container-security.yml');
  for (const dockerfile of Object.values(DOCKERFILES)) {
    assert.ok(
      workflow.includes(`dockerfile: ${dockerfile}`),
      `container-security must scan ${dockerfile}`,
    );
  }
});

check('compose images are pinned to a version tag; storage also to its verified digest', () => {
  for (const [name, service] of Object.entries(defaultServices())) {
    if (!service.image) continue;
    const [reference] = service.image.split('@');
    const tag = /:([^/:]+)$/.exec(reference ?? '')?.[1];
    assert.ok(tag && tag !== 'latest', `${name}: image ${service.image} must use a version tag`);
  }
  for (const name of ['rustfs', 'rustfs-init']) {
    assert.equal(
      defaultServices()[name]?.image,
      STORAGE_IMAGE,
      `${name} must use ${STORAGE_IMAGE}`,
    );
  }
});

check('rustfs-init provisions both buckets idempotently with mcli and fails on errors', () => {
  const script = defaultServices()['rustfs-init']?.entrypoint?.join(' ') ?? '';
  assert.match(script, /set -eu/, 'rustfs-init must stop on the first error');
  assert.match(script, /mcli mb --ignore-existing/, 'buckets must be created idempotently');
  assert.match(script, /mcli stat/, 'rustfs-init must fail when a bucket is still missing');
  assert.doesNotMatch(script, /exit 0/, 'rustfs-init must not mask failures');
  for (const bucket of STORAGE_BUCKETS) assert.ok(script.includes(bucket), `missing ${bucket}`);
});

// 2b. Health probes (F-01): every probe must hit a route the API really serves.
check('API and Caddy health checks probe the real API liveness route', () => {
  const valid = apiLivenessPaths();
  const config = defaultServices();
  const dockerfileProbe = /HEALTHCHECK[\s\S]*?CMD (.+)/.exec(read(DOCKERFILES.api))?.[1] ?? '';
  const problems = [
    ...probeProblems('compose api', config.api?.healthcheck?.test?.join(' ') ?? '', valid, {
      https: false,
    }),
    ...probeProblems(DOCKERFILES.api, dockerfileProbe, valid, { https: false }),
    ...probeProblems('compose caddy', config.caddy?.healthcheck?.test?.join(' ') ?? '', valid, {
      https: true,
    }),
  ];
  assert.deepEqual(problems, [], problems.join('\n'));
  assert.equal(
    config.caddy?.environment?.TLS_MODE,
    'internal',
    'the Caddy probe assumes TLS_MODE internal',
  );
});

check('probe check rejects the paths that return 404 and insecure Caddy probes', () => {
  const valid = apiLivenessPaths();
  const api = 'wget --spider http://localhost:3001/api/v1/health/live || exit 1';
  const caddy = `SSL_CERT_FILE=${CADDY_INTERNAL_ROOT} wget --spider https://localhost/api/v1/health/live`;
  assert.deepEqual(probeProblems('api', api, valid, { https: false }), []);
  assert.deepEqual(probeProblems('caddy', caddy, valid, { https: true }), []);
  const broken = [
    probeProblems('api', api.replace('/api/v1/health/live', '/health/live'), valid, {
      https: false,
    }),
    probeProblems('api', api.replace('/health/live', '/healthz'), valid, { https: false }),
    probeProblems('caddy', 'wget --spider http://localhost:80/health/live', valid, { https: true }),
    probeProblems('caddy', `${caddy} --no-check-certificate`, valid, { https: true }),
    probeProblems('caddy', caddy.replace(`SSL_CERT_FILE=${CADDY_INTERNAL_ROOT} `, ''), valid, {
      https: true,
    }),
  ];
  for (const problems of broken) assert.ok(problems.length > 0, 'a broken probe was accepted');
});

// 3. Caddy Reverse Proxy & Security Headers (FND-INF-004)
check('Caddyfile exists with route separation, upload limits, and security headers', () => {
  const caddyPath = path.join(rootDir, 'infrastructure/caddy/Caddyfile');
  assert.ok(fs.existsSync(caddyPath), 'Caddyfile must exist');
  const content = fs.readFileSync(caddyPath, 'utf-8');

  assert.ok(
    content.includes('/api/v1/attachments/*'),
    'Caddyfile must configure attachment upload route',
  );
  assert.ok(content.includes('max_size 50MB'), 'Caddyfile must set attachment max_size to 50MB');
  assert.ok(content.includes('/webhooks/*'), 'Caddyfile must configure webhook route');
  assert.ok(content.includes('max_size 5MB'), 'Caddyfile must set webhook max_size to 5MB');
  assert.ok(content.includes('Strict-Transport-Security'), 'Caddyfile must configure HSTS');
  assert.ok(
    content.includes('X-Content-Type-Options "nosniff"'),
    'Caddyfile must configure nosniff',
  );
  assert.ok(
    content.includes('tls {$TLS_MODE:internal}'),
    'Caddyfile must support variable TLS mode',
  );
});

check('Caddy maps legacy /health/* to /api/v1/health/* without changing the API prefix', () => {
  const content = read('infrastructure/caddy/Caddyfile');
  const block = /handle \/health\/\* \{([\s\S]*?)\n {4}\}/.exec(content)?.[1] ?? '';
  assert.ok(block.includes('rewrite * /api/v1{path}'), '/health/* must be rewritten to /api/v1');
  assert.ok(block.includes('reverse_proxy api:3001'), '/health/* must proxy to the API');
  assert.match(read('apps/api/src/main.ts'), /setGlobalPrefix\('api\/v1'\)/);
});

// 3b. Isolated compose smoke (VYN-01-03)
check('compose smoke overlay renders an isolated vynor-wu01-smoke project', () => {
  const ports = readSmokePorts(fs.readFileSync(smokeEnvFile, 'utf-8'));
  const config = renderCompose(['docker-compose.yml', smokeOverlay]);
  const problems = checkSmokeConfig(config, rootDir, ports);
  assert.deepEqual(problems, [], problems.join('\n'));
});

check('compose smoke guard rejects configs and URLs that reach live resources', () => {
  const ports = readSmokePorts(fs.readFileSync(smokeEnvFile, 'utf-8'));
  const base = renderCompose(['docker-compose.yml', smokeOverlay]);
  // Loose view of the rendered JSON so a test can break one field at a time.
  interface Mutable {
    name?: string;
    services: Record<
      string,
      {
        container_name?: string;
        restart?: string;
        environment: Record<string, string>;
        ports: { host_ip?: string; published?: string }[];
      }
    >;
    volumes: Record<string, { name?: string }>;
    networks: Record<string, { external?: boolean }>;
  }
  const mutations: Record<string, (config: Mutable) => void> = {
    'live project name': (c) => (c.name = 'vynor-crm'),
    'fixed container name': (c) => (c.services.postgres.container_name = 'vynor-postgres'),
    'live database': (c) => (c.services.postgres.environment.POSTGRES_DB = 'vynor'),
    'live database URL': (c) =>
      (c.services.api.environment.DATABASE_URL =
        'postgresql://postgres:postgres@postgres:5432/vynor_crm'),
    'port on all interfaces': (c) => (c.services.api.ports[0].host_ip = '0.0.0.0'),
    'default port': (c) => (c.services.postgres.ports[0].published = '5432'),
    'live volume': (c) => (c.volumes.postgres_data.name = 'vynor-crm_postgres_data'),
    'external network': (c) => (c.networks['vynor-network'].external = true),
    'restart policy': (c) => (c.services.worker.restart = 'unless-stopped'),
    'production URL': (c) =>
      (c.services.api.environment.PUBLIC_WEBHOOK_BASE_URL = 'https://crm.vynor.io'),
    'real secret': (c) => (c.services.api.environment.ENCRYPTION_MASTER_KEY = 'c2VjcmV0'),
  };
  for (const [label, mutate] of Object.entries(mutations)) {
    const config = structuredClone(base) as unknown as Mutable;
    mutate(config);
    const problems = checkSmokeConfig(config as unknown as ComposeConfig, rootDir, ports);
    assert.ok(problems.length > 0, `guard accepted: ${label}`);
  }
  const port = ports.get('SMOKE_POSTGRES_PORT') ?? '';
  const ok = `postgresql://postgres:postgres@127.0.0.1:${port}/vynor_test?schema=public`;
  assert.deepEqual(checkHostDatabaseUrl(ok, port), []);
  for (const url of [
    'postgresql://postgres:postgres@localhost:5434/vynor_test?schema=public',
    `postgresql://postgres:postgres@127.0.0.1:${port}/vynor_crm`,
    `postgresql://postgres:postgres@127.0.0.1:${port}/vynor`,
    'postgresql://postgres:postgres@db.example.com:5432/vynor_test',
  ]) {
    assert.ok(checkHostDatabaseUrl(url, port).length > 0, `guard accepted ${url}`);
  }
});

check('compose smoke runner and CI job keep the project, guards and cleanup', () => {
  const runner = read('infrastructure/scripts/compose-smoke.sh');
  assert.ok(runner.includes(`readonly PROJECT='${SMOKE_PROJECT}'`), 'runner must pin the project');
  assert.ok(runner.includes('exec env -i'), 'runner must sanitize the environment');
  assert.ok(runner.includes('flock -n'), 'runner must refuse parallel runs');
  assert.ok(!/compose down[^\n]*--rmi/.test(runner), 'teardown must not remove images');
  assert.ok(runner.includes('compose-smoke-s3.mts'), 'runner must check the S3 contract');
  const workflow = read('.github/workflows/compose-smoke.yml');
  assert.ok(workflow.includes('timeout-minutes:'), 'compose-smoke job must have a timeout');
  assert.ok(workflow.includes('compose-smoke.sh all'), 'compose-smoke job must use the runner');
  assert.ok(workflow.includes('if: always()'), 'compose-smoke job must always clean up');
});

// 4. Supabase Connection & Open Question (FND-INF-003)
check(
  'Supabase connection documentation exists and resolves the Local Supabase Open Question',
  () => {
    const docPath = path.join(rootDir, 'docs/supabase-connection-guide.md');
    assert.ok(fs.existsSync(docPath), 'docs/supabase-connection-guide.md must exist');
    const content = fs.readFileSync(docPath, 'utf-8');

    assert.ok(content.includes('DATABASE_URL'), 'Doc must specify DATABASE_URL');
    assert.ok(content.includes('DIRECT_URL'), 'Doc must specify DIRECT_URL');
    assert.ok(content.includes('Port 6543'), 'Doc must specify pooler port 6543');
    assert.ok(content.includes('Port 5432'), 'Doc must specify direct port 5432');
    assert.ok(content.includes('OPEN QUESTION'), 'Doc must address the OPEN QUESTION');
    assert.ok(
      content.includes('Option A: Hosted Supabase'),
      'Doc must evaluate Hosted Supabase option',
    );
    assert.ok(
      content.includes('Option B: Local Supabase CLI'),
      'Doc must evaluate Local Supabase CLI option',
    );
  },
);

// 5. GitHub Actions CI Workflows (FND-INF-006)
check('.github/workflows/ci.yml exists with code quality, drift, and verifications', () => {
  const ciPath = path.join(rootDir, '.github/workflows/ci.yml');
  assert.ok(fs.existsSync(ciPath), '.github/workflows/ci.yml must exist');
  const content = fs.readFileSync(ciPath, 'utf-8');

  assert.ok(content.includes('pnpm format:check'), 'ci.yml must check code formatting');
  assert.ok(content.includes('pnpm lint'), 'ci.yml must run linter');
  assert.ok(content.includes('pnpm typecheck'), 'ci.yml must run typechecker');
  assert.ok(content.includes('pnpm build'), 'ci.yml must run monorepo build');
  assert.ok(content.includes('db:migrate:diff'), 'ci.yml must verify migration drift');
  assert.ok(content.includes('db:verify'), 'ci.yml must run schema verification');
});

// 6. Container Security, Vulnerability Scan, SBOM & Provenance (FND-INF-007)
check(
  'Container security workflow and documentation exist with Trivy and SBOM specifications',
  () => {
    const secWorkflowPath = path.join(rootDir, '.github/workflows/container-security.yml');
    const secDocPath = path.join(rootDir, 'docs/container-security-and-provenance.md');
    assert.ok(fs.existsSync(secWorkflowPath), 'container-security.yml must exist');
    assert.ok(fs.existsSync(secDocPath), 'docs/container-security-and-provenance.md must exist');

    const workflow = fs.readFileSync(secWorkflowPath, 'utf-8');
    assert.ok(workflow.includes('trivy-action'), 'Workflow must use Trivy vulnerability scanner');
    assert.ok(workflow.includes('sbom-action'), 'Workflow must use SBOM action');
    assert.ok(workflow.includes('matrix:'), 'Workflow must scan all core containers in a matrix');

    const doc = fs.readFileSync(secDocPath, 'utf-8');
    assert.ok(doc.includes('CRITICAL'), 'Doc must define CRITICAL vulnerability policy');
    assert.ok(doc.includes('SPDX'), 'Doc must document SPDX SBOM format');
    assert.ok(doc.includes('CycloneDX'), 'Doc must document CycloneDX SBOM format');
    assert.ok(doc.includes('Cosign'), 'Doc must document Sigstore Cosign signing');
    assert.ok(doc.includes('SLSA'), 'Doc must document SLSA provenance attestation');
  },
);

console.info('------------------------------------------------------');
console.info(`  Total Checks: ${checkCount}`);
console.info('  Status:       ALL INFRASTRUCTURE CHECKS PASSED [OK]');
console.info('======================================================');
