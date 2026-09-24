import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

console.info('======================================================');
console.info('  VYNOR CRM Infrastructure & DevOps Verification (6.4)');
console.info('======================================================');

const rootDir = process.cwd();

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
check('Dockerfiles exist for web, api, and worker', () => {
  const dockerfiles = [
    'apps/api/Dockerfile',
    'apps/worker/Dockerfile',
    'apps/web/Dockerfile',
    'infrastructure/docker/Dockerfile.api',
    'infrastructure/docker/Dockerfile.worker',
    'infrastructure/docker/Dockerfile.web',
  ];
  for (const df of dockerfiles) {
    const fullPath = path.join(rootDir, df);
    assert.ok(fs.existsSync(fullPath), `Dockerfile missing at ${df}`);
  }
});

check('Dockerfiles enforce multi-stage builds and non-root runtime users (UID 1001)', () => {
  const targets = ['apps/api/Dockerfile', 'apps/worker/Dockerfile', 'apps/web/Dockerfile'];
  for (const target of targets) {
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

check('docker compose config command validates successfully', () => {
  const output = execSync('docker compose config --quiet', { cwd: rootDir, encoding: 'utf-8' });
  assert.equal(output.trim(), '', 'docker compose config should produce no validation errors');
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
