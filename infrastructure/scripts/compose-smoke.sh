#!/usr/bin/env bash
# Guarded runner for the isolated WU-01 compose smoke (VYN-01-03).
#
#   infrastructure/scripts/compose-smoke.sh <command>
#
#   preflight   Read-only. Render and check the final config, refuse leftovers and busy
#               ports, snapshot the live vynor-postgres metadata (docker inspect only).
#   up          preflight, start the smoke PostgreSQL, prove its identity, migrate and seed
#               vynor_test on it, then build and start the whole stack and wait for health.
#   check       Health of every service, API directly, Caddy over verified HTTPS, worker
#               heartbeat, web startup, storage health and the app's S3 client round trip,
#               then Redis (WU-04): its config and auth, API readiness on it, and a key that
#               survives a SIGKILL of Redis through the AOF while the API reports not ready.
#   logs        Save compose logs, health logs and the rendered config to the artifact dir.
#   down        Tear down, after proving every resource belongs to the smoke project.
#   postflight  Read-only. The live vynor-postgres must be unchanged and no smoke resource left.
#   all         preflight, up, check, logs, down, postflight. On failure it still saves logs,
#               tears down (unless SMOKE_KEEP_ON_FAILURE=1) and runs postflight.
#
# Safety: the project name is fixed below and every compose call goes through compose(),
# which always passes it. The script re-executes itself with an empty environment plus an
# allowlist, so shell variables (COMPOSE_*, DATABASE_URL, POSTGRES_PORT, ...) cannot change
# the config: --env-file alone does not stop that, because compose prefers shell variables.
# Only the local Docker daemon is accepted, and a lock prevents two runs at once.
set -Eeuo pipefail

readonly PROJECT='vynor-wu01-smoke'
readonly LIVE_PROJECT='vynor-crm'
readonly LIVE_DB_CONTAINER='vynor-postgres'
readonly LIVE_DB_VOLUME='vynor-crm_postgres_data'
readonly SMOKE_DATABASE='vynor_test'
readonly LONG_RUNNING_SERVICES=(postgres redis rustfs api worker web caddy)
readonly ENV_ALLOWLIST=(PATH HOME USER LANG TMPDIR CI GITHUB_ACTIONS SMOKE_ARTIFACT_DIR SMOKE_KEEP_ON_FAILURE)

SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/$(basename "${BASH_SOURCE[0]}")"
ROOT="$(cd "$(dirname "$SELF")/../.." && pwd -P)"
readonly SELF ROOT
readonly ENV_FILE="$ROOT/infrastructure/docker/smoke.env"
readonly OVERLAY="$ROOT/infrastructure/docker/compose.smoke.yml"
readonly GUARD="$ROOT/infrastructure/scripts/compose-smoke-guard.mts"
readonly S3_CHECK="$ROOT/infrastructure/scripts/compose-smoke-s3.mts"

log() { printf 'compose-smoke: %s\n' "$*" >&2; }
die() {
  log "STOP: $*"
  exit 1
}

# --- environment sanitization (runs before anything else) ---------------------------------

if [[ "${VYNOR_SMOKE_SANITIZED:-}" != 1 ]]; then
  for var in DOCKER_HOST DOCKER_CONTEXT; do
    [[ -z "${!var:-}" ]] || die "$var is set; the smoke only runs against the local Docker daemon"
  done
  dropped="$(compgen -e | grep -E '^(COMPOSE_|DOCKER_|DATABASE_URL|DIRECT_URL|POSTGRES_|PG)' | tr '\n' ' ' || true)"
  [[ -z "$dropped" ]] || log "ignoring inherited variables: $dropped"
  keep=(VYNOR_SMOKE_SANITIZED=1)
  for var in "${ENV_ALLOWLIST[@]}"; do
    if [[ -n "${!var+x}" ]]; then keep+=("$var=${!var}"); fi
  done
  exec env -i "${keep[@]}" bash "$SELF" "$@"
fi

[[ "$PROJECT" == 'vynor-wu01-smoke' && "$PROJECT" != "$LIVE_PROJECT" ]] || die "bad project name"

readonly STATE_DIR="${TMPDIR:-/tmp}/$PROJECT"
readonly ARTIFACT_DIR="${SMOKE_ARTIFACT_DIR:-$STATE_DIR/artifacts}"
# Fixed path (not under TMPDIR): the Docker daemon is shared, so the lock must be too.
readonly LOCK_FILE="/tmp/$PROJECT.lock"
readonly LIVE_SNAPSHOT="$STATE_DIR/live-snapshot.before"
mkdir -p "$STATE_DIR" "$ARTIFACT_DIR"

# Smoke host ports (also checked by the guard against the rendered config).
# shellcheck disable=SC1090
source <(grep -E '^SMOKE_[A-Z_]+_PORT=[0-9]+$' "$ENV_FILE")
readonly SMOKE_PORTS=("$SMOKE_POSTGRES_PORT" "$SMOKE_RUSTFS_API_PORT" "$SMOKE_RUSTFS_CONSOLE_PORT"
  "$SMOKE_API_PORT" "$SMOKE_WEB_PORT" "$SMOKE_CADDY_HTTPS_PORT")
readonly HOST_DB_URL="postgresql://postgres:postgres@127.0.0.1:${SMOKE_POSTGRES_PORT}/${SMOKE_DATABASE}?schema=public"

compose() {
  docker compose --project-name "$PROJECT" --project-directory "$ROOT" --env-file "$ENV_FILE" \
    -f "$ROOT/docker-compose.yml" -f "$OVERLAY" "$@"
}

# One run at a time. Child invocations from `all` inherit the parent's lock.
acquire_lock() {
  if [[ "${VYNOR_SMOKE_LOCK_HELD:-}" == 1 ]]; then return; fi
  exec 9>"$LOCK_FILE"
  flock -n 9 || die "another compose smoke run holds $LOCK_FILE"
  export VYNOR_SMOKE_LOCK_HELD=1
}

container_of() {
  local id
  id="$(compose ps --all --quiet "$1")"
  [[ -n "$id" && "$id" != *$'\n'* ]] || die "expected exactly one container for service $1"
  docker container inspect --format '{{.Id}}' "$id"
}

# --- read-only checks ---------------------------------------------------------------------

check_docker_daemon() {
  local endpoint
  endpoint="$(docker context inspect --format '{{.Endpoints.docker.Host}}')"
  [[ "$endpoint" == unix://* ]] || die "Docker endpoint $endpoint is not a local unix socket"
  docker compose version --short >/dev/null || die "docker compose v2 is required"
}

render_and_guard() {
  compose config --format json >"$ARTIFACT_DIR/compose.rendered.json"
  node "$GUARD" config "$ARTIFACT_DIR/compose.rendered.json" "$ROOT" "$ENV_FILE" ||
    die "rendered config failed the isolation guard"
}

# Resources of the smoke project left by an earlier run, or resources that only look like it.
# Nothing is removed here: an operator decides (`down` proves ownership before removing).
check_no_leftovers() {
  local labelled named
  labelled="$(
    docker ps --all --quiet --filter "label=com.docker.compose.project=$PROJECT"
    docker volume ls --quiet --filter "label=com.docker.compose.project=$PROJECT"
    docker network ls --quiet --filter "label=com.docker.compose.project=$PROJECT"
  )"
  named="$(
    docker ps --all --format '{{.Names}}' | grep -E "^$PROJECT" || true
    docker volume ls --format '{{.Name}}' | grep -E "^$PROJECT" || true
    docker network ls --format '{{.Name}}' | grep -E "^$PROJECT" || true
  )"
  if [[ -n "$labelled$named" ]]; then
    log "existing resources for $PROJECT:"
    printf '%s\n%s\n' "$labelled" "$named" | sed '/^$/d; s/^/  /' >&2
    die "resources of $PROJECT already exist; inspect them, then run '$0 down' if they are smoke leftovers"
  fi
}

check_ports_free() {
  local port
  for port in "${SMOKE_PORTS[@]}"; do
    if (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
      die "port 127.0.0.1:$port is already in use"
    fi
  done
}

# Metadata only (docker inspect): no exec into and no connection to the live database.
live_snapshot() {
  if docker container inspect "$LIVE_DB_CONTAINER" >/dev/null 2>&1; then
    docker container inspect "$LIVE_DB_CONTAINER" --format \
      '{{.Id}} {{.State.StartedAt}} restarts={{.RestartCount}} {{index .Config.Labels "com.docker.compose.config-hash"}} {{json .Mounts}} {{json .HostConfig.PortBindings}}'
  else
    echo "container $LIVE_DB_CONTAINER absent"
  fi
  if docker volume inspect "$LIVE_DB_VOLUME" >/dev/null 2>&1; then
    echo "volume $LIVE_DB_VOLUME present"
  else
    echo "volume $LIVE_DB_VOLUME absent"
  fi
}

cmd_preflight() {
  for tool in docker node curl flock; do
    command -v "$tool" >/dev/null || die "$tool is required"
  done
  check_docker_daemon
  render_and_guard
  check_no_leftovers
  check_ports_free
  live_snapshot >"$LIVE_SNAPSHOT"
  cp "$LIVE_SNAPSHOT" "$ARTIFACT_DIR/live-snapshot.before"
  log "preflight passed (project $PROJECT, artifacts in $ARTIFACT_DIR)"
}

# --- state-changing steps -----------------------------------------------------------------

# The smoke PostgreSQL behind 127.0.0.1:$SMOKE_POSTGRES_PORT must be the container of this
# project, and the host connection must reach that same instance, before anything writes to it.
verify_smoke_postgres() {
  local id name project publishers system_id
  id="$(container_of postgres)"
  name="$(docker container inspect --format '{{.Name}}' "$id")"
  project="$(docker container inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$id")"
  [[ "$name" == "/$PROJECT-"* && "$project" == "$PROJECT" ]] || die "postgres container $name is not owned by $PROJECT"
  docker container inspect --format '{{range .Mounts}}{{.Name}} {{end}}' "$id" | grep -qx "${PROJECT}_postgres_data " ||
    die "smoke postgres does not mount ${PROJECT}_postgres_data only"
  publishers="$(docker ps --quiet --no-trunc --filter "publish=$SMOKE_POSTGRES_PORT")"
  [[ "$publishers" == "$id" ]] || die "port $SMOKE_POSTGRES_PORT is not published by the smoke postgres alone"
  [[ "$(compose port postgres 5432)" == "127.0.0.1:$SMOKE_POSTGRES_PORT" ]] || die "smoke postgres is not bound to 127.0.0.1:$SMOKE_POSTGRES_PORT"

  system_id="$(compose exec -T postgres psql -U postgres -d "$SMOKE_DATABASE" -Atc \
    'select system_identifier from pg_control_system()')"
  [[ "$system_id" =~ ^[0-9]+$ ]] || die "could not read the smoke postgres system identifier"
  node "$GUARD" db-url "$HOST_DB_URL" "$SMOKE_POSTGRES_PORT" || die "host database URL failed the guard"
  # Read-only identity check over the host connection that migrate and seed will use.
  pnpm --filter @vynor/database exec prisma db execute --url "$HOST_DB_URL" --stdin <<SQL ||
DO \$\$
BEGIN
  IF current_database() <> '$SMOKE_DATABASE' THEN
    RAISE EXCEPTION 'connected to %, not $SMOKE_DATABASE', current_database();
  END IF;
  IF (SELECT system_identifier::text FROM pg_control_system()) <> '$system_id' THEN
    RAISE EXCEPTION 'host port reaches a different PostgreSQL instance';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_database WHERE datname IN ('vynor', 'vynor_crm')) THEN
    RAISE EXCEPTION 'instance holds live databases';
  END IF;
END
\$\$;
SQL
    die "host connection did not reach the smoke PostgreSQL"
  log "smoke postgres verified: $name, 127.0.0.1:$SMOKE_POSTGRES_PORT, $SMOKE_DATABASE, system id $system_id"
}

cmd_up() {
  cmd_preflight
  command -v pnpm >/dev/null || die "pnpm is required (migrate and seed run from the workspace)"
  compose up --detach --wait --wait-timeout 120 postgres
  # The seed needs the generated Prisma client and a built @vynor/contracts; the S3 check in
  # `check` drives the built @vynor/storage client.
  pnpm exec turbo run build --filter=@vynor/database... --filter=@vynor/storage...
  verify_smoke_postgres
  DATABASE_URL="$HOST_DB_URL" DIRECT_URL="$HOST_DB_URL" pnpm --filter @vynor/database db:migrate:deploy
  DATABASE_URL="$HOST_DB_URL" DIRECT_URL="$HOST_DB_URL" pnpm --filter @vynor/database db:seed
  # rustfs-init is a one-shot job that must be idempotent: run it, then run the same container
  # again; both runs must exit 0 (it fails when a bucket is still missing).
  compose up --detach rustfs-init
  local init_id code run
  init_id="$(container_of rustfs-init)"
  for run in 1 2; do
    if ((run == 2)); then compose start rustfs-init; fi
    code="$(docker wait "$init_id")"
    echo "rustfs-init run $run exit=$code" | tee -a "$ARTIFACT_DIR/rustfs-init.exit" >&2
    [[ "$code" == 0 ]] || die "rustfs-init run $run failed with exit code $code"
  done
  compose up --detach --build --wait --wait-timeout 300 api worker web caddy
  log "stack is up"
}

http_status() {
  curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 10 "$@"
}

expect_status() {
  local want="$1" label="$2" got
  shift 2
  got="$(http_status "$@" || true)"
  printf '%-58s %s (want %s)\n' "$label" "$got" "$want" | tee -a "$ARTIFACT_DIR/checks.txt" >&2
  [[ "$got" == "$want" ]]
}

# redis-cli inside the Redis container, authenticated with the container's own password.
redis_cli() {
  # shellcheck disable=SC2016 # expanded inside the container
  compose exec -T redis sh -c 'redis-cli --no-auth-warning -a "$REDIS_PASSWORD" "$@"' redis-cli "$@"
}

# Polls a command once a second until it succeeds or the timeout (seconds) runs out.
wait_until() {
  local deadline=$((SECONDS + $1))
  shift
  until "$@"; do
    ((SECONDS < deadline)) || return 1
    sleep 1
  done
}

api_ready_status() {
  http_status "http://127.0.0.1:$SMOKE_API_PORT/api/v1/health/ready"
}

api_ready_is() {
  [[ "$(api_ready_status || true)" == "$1" ]]
}

container_healthy() {
  [[ "$(docker container inspect --format '{{.State.Health.Status}}' "$1" 2>/dev/null)" == healthy ]]
}

redis_aof_has() {
  # shellcheck disable=SC2016 # expanded inside the container
  compose exec -T redis sh -c 'grep -q "$1" /data/appendonlydir/*.incr.aof' sh "$1" 2>/dev/null
}

record() {
  printf '%-58s %s\n' "$1" "$2" | tee -a "$ARTIFACT_DIR/checks.txt" >&2
}

# VYN-04-01: Redis runs with the configured persistence and memory policy, needs its password,
# the API is ready only while Redis answers, and a key written before Redis is killed (no
# shutdown save) is back after the restart, which only the AOF can provide.
check_redis() {
  local failed=0 setting want got ready token id
  for setting in appendonly:yes appendfsync:everysec maxmemory-policy:noeviction maxmemory:268435456; do
    want="${setting#*:}"
    got="$(redis_cli CONFIG GET "${setting%%:*}" | sed -n 2p | tr -d '\r')"
    record "redis CONFIG GET ${setting%%:*}" "$got (want $want)"
    [[ "$got" == "$want" ]] || failed=1
  done
  got="$(compose exec -T redis redis-cli ping 2>&1 | tr -d '\r' || true)"
  record 'redis without password' "$got"
  [[ "$got" == NOAUTH* ]] || failed=1
  # compose prints ":0" for a port that is not published.
  got="$(compose port redis 6379 2>/dev/null || true)"
  [[ "$got" == ':0' ]] && got=''
  record 'redis published port' "${got:-none}"
  [[ -z "$got" ]] || failed=1

  ready="$(curl --silent --max-time 10 "http://127.0.0.1:$SMOKE_API_PORT/api/v1/health/ready" || true)"
  record 'API /api/v1/health/ready reports redis UP' "$(grep -o '"redis":{"status":"[A-Z]*"' <<<"$ready" || echo missing)"
  grep -q '"redis":{"status":"UP"' <<<"$ready" || failed=1

  token="wu04-smoke-$(date +%s%N)"
  redis_cli SET vynor:smoke:persistence "$token" >/dev/null
  if wait_until 10 redis_aof_has "$token"; then
    record 'redis key written to the AOF' 'yes'
  else
    record 'redis key written to the AOF' 'NO'
    failed=1
  fi
  id="$(container_of redis)"
  docker kill --signal KILL "$id" >/dev/null
  # docker kill returns once the signal is sent; wait until the container has really stopped.
  record 'redis killed (SIGKILL): exit code' "$(docker wait "$id")"
  if wait_until 30 api_ready_is 503; then
    record 'redis killed (SIGKILL): API /health/ready' '503 (not ready)'
  else
    record 'redis killed (SIGKILL): API /health/ready' "$(api_ready_status || true) (want 503)"
    failed=1
  fi
  compose start redis
  if ! wait_until 60 container_healthy "$id"; then
    record 'redis restarted: health' 'NOT healthy within 60 s'
    return 1
  fi
  got="$(redis_cli GET vynor:smoke:persistence | tr -d '\r')"
  record 'redis restarted: key written before the kill' "$([[ "$got" == "$token" ]] && echo present || echo "MISSING ($got)")"
  [[ "$got" == "$token" ]] || failed=1
  redis_cli DEL vynor:smoke:persistence >/dev/null
  if wait_until 30 api_ready_is 200; then
    record 'redis back: API /health/ready (reconnected)' '200'
  else
    record 'redis back: API /health/ready (reconnected)' "$(api_ready_status || true) (want 200)"
    failed=1
  fi
  ((failed == 0))
}

cmd_check() {
  local failed=0 service id state ca heartbeat age
  : >"$ARTIFACT_DIR/checks.txt"
  for service in "${LONG_RUNNING_SERVICES[@]}"; do
    id="$(container_of "$service")"
    state="$(docker container inspect --format '{{.State.Status}} {{.State.Health.Status}} restarts={{.RestartCount}}' "$id")"
    printf '%-58s %s\n' "service $service" "$state" | tee -a "$ARTIFACT_DIR/checks.txt" >&2
    [[ "$state" == 'running healthy restarts=0' ]] || failed=1
  done

  expect_status 200 'API direct /api/v1/health/live' "http://127.0.0.1:$SMOKE_API_PORT/api/v1/health/live" || failed=1
  expect_status 404 'API direct /health/live (F-01: no such route)' "http://127.0.0.1:$SMOKE_API_PORT/health/live" || failed=1
  expect_status 200 'web direct /' "http://127.0.0.1:$SMOKE_WEB_PORT/" || failed=1
  expect_status 200 'storage direct /minio/health/live' "http://127.0.0.1:$SMOKE_RUSTFS_API_PORT/minio/health/live" || failed=1
  # The application's own S3 client against the smoke store (both buckets, signed download).
  node "$S3_CHECK" "$ARTIFACT_DIR/compose.rendered.json" "http://127.0.0.1:$SMOKE_RUSTFS_API_PORT" 2>&1 |
    tee -a "$ARTIFACT_DIR/checks.txt" >&2 || failed=1
  # Remove the objects it wrote with the store's own client (mcli) and prove they are gone.
  # shellcheck disable=SC2016 # expanded inside the container
  if compose exec -T rustfs sh -c 'set -eu
    mcli alias set storage http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
    for bucket in vynor-crm-attachments vynor-crm-attachments-quarantine; do
      mcli rm --recursive --force "storage/$bucket/wu01-smoke/" >/dev/null
      [ -z "$(mcli ls --recursive "storage/$bucket/wu01-smoke/")" ]
    done'; then
    printf '%-58s %s\n' 'storage cleanup (mcli rm + ls)' 'objects removed' | tee -a "$ARTIFACT_DIR/checks.txt" >&2
  else
    printf '%-58s %s\n' 'storage cleanup (mcli rm + ls)' 'FAILED' | tee -a "$ARTIFACT_DIR/checks.txt" >&2
    failed=1
  fi

  # Caddy uses its internal CA (TLS_MODE internal). Trust exactly that root for these requests;
  # certificate verification stays on, and --resolve keeps SNI and Host at localhost.
  ca="$ARTIFACT_DIR/caddy-internal-root.crt"
  compose cp caddy:/data/caddy/pki/authorities/local/root.crt "$ca"
  local tls=(--cacert "$ca" --resolve "localhost:$SMOKE_CADDY_HTTPS_PORT:127.0.0.1")
  local base="https://localhost:$SMOKE_CADDY_HTTPS_PORT"
  expect_status 200 'Caddy HTTPS /api/v1/health/live' "${tls[@]}" "$base/api/v1/health/live" || failed=1
  expect_status 200 'Caddy HTTPS /health/live (rewrite to /api/v1)' "${tls[@]}" "$base/health/live" || failed=1
  expect_status 200 'Caddy HTTPS / (web)' "${tls[@]}" "$base/" || failed=1

  if compose exec -T worker node apps/worker/dist/healthcheck.js; then
    # shellcheck disable=SC2016 # expanded inside the worker container
    heartbeat="$(compose exec -T worker sh -c 'cat "${TMPDIR:-/tmp}/vynor-worker.heartbeat"')"
    age=$(($(date +%s%3N) - heartbeat))
    printf '%-58s fresh (age %s ms)\n' 'worker heartbeat' "$age" | tee -a "$ARTIFACT_DIR/checks.txt" >&2
  else
    printf '%-58s STALE or missing\n' 'worker heartbeat' | tee -a "$ARTIFACT_DIR/checks.txt" >&2
    failed=1
  fi

  # Last: it stops and restarts Redis.
  check_redis || failed=1

  ((failed == 0)) || die "smoke checks failed (see $ARTIFACT_DIR/checks.txt)"
  log "all smoke checks passed"
}

cmd_logs() {
  local service id
  compose ps --all >"$ARTIFACT_DIR/compose-ps.txt" 2>&1 || true
  compose logs --no-color --timestamps >"$ARTIFACT_DIR/compose.log" 2>&1 || true
  for service in "${LONG_RUNNING_SERVICES[@]}" rustfs-init; do
    id="$(compose ps --all --quiet "$service" 2>/dev/null || true)"
    [[ -n "$id" ]] || continue
    docker container inspect --format '{{json .State}}' "$id" >"$ARTIFACT_DIR/state-$service.json" 2>&1 || true
  done
  log "logs saved to $ARTIFACT_DIR"
}

# Remove only what is proven to belong to the smoke project; refuse otherwise.
cmd_down() {
  check_docker_daemon
  local id name files resource
  for id in $(docker ps --all --quiet --filter "label=com.docker.compose.project=$PROJECT"); do
    name="$(docker container inspect --format '{{.Name}}' "$id")"
    files="$(docker container inspect --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}' "$id")"
    [[ "$name" == "/$PROJECT-"* && "$files" == *infrastructure/docker/compose.smoke.yml* ]] ||
      die "container $name carries the $PROJECT label but was not created from the smoke overlay"
  done
  for resource in $(docker volume ls --quiet --filter "label=com.docker.compose.project=$PROJECT") \
    $(docker network ls --format '{{.Name}}' --filter "label=com.docker.compose.project=$PROJECT"); do
    [[ "$resource" == "${PROJECT}_"* && "$resource" != "$LIVE_DB_VOLUME" ]] ||
      die "resource $resource carries the $PROJECT label but not the ${PROJECT}_ prefix"
  done
  # Same-named resources without the label are not ours; compose would still remove them by name.
  for resource in $(docker ps --all --format '{{.Names}}' --filter "name=^$PROJECT"); do
    [[ "$(docker container inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$resource")" == "$PROJECT" ]] ||
      die "container $resource looks like a smoke resource but has no $PROJECT label; not touching it"
  done
  for resource in $(docker volume ls --quiet --filter "name=^$PROJECT"); do
    [[ "$(docker volume inspect --format '{{index .Labels "com.docker.compose.project"}}' "$resource")" == "$PROJECT" ]] ||
      die "volume $resource looks like a smoke resource but has no $PROJECT label; not touching it"
  done
  for resource in $(docker network ls --format '{{.Name}}' --filter "name=^$PROJECT"); do
    [[ "$(docker network inspect --format '{{index .Labels "com.docker.compose.project"}}' "$resource")" == "$PROJECT" ]] ||
      die "network $resource looks like a smoke resource but has no $PROJECT label; not touching it"
  done
  # No --rmi: built images (vynor-wu01-smoke-*) are kept; remove them by hand if wanted.
  compose down --volumes --remove-orphans --timeout 20
  log "teardown done"
}

cmd_postflight() {
  check_docker_daemon
  local left
  left="$(
    docker ps --all --quiet --filter "label=com.docker.compose.project=$PROJECT"
    docker volume ls --quiet --filter "label=com.docker.compose.project=$PROJECT"
    docker network ls --quiet --filter "label=com.docker.compose.project=$PROJECT"
  )"
  [[ -z "$left" ]] || die "smoke resources still exist after teardown: $(tr '\n' ' ' <<<"$left")"
  [[ -f "$LIVE_SNAPSHOT" ]] || die "no preflight snapshot at $LIVE_SNAPSHOT"
  live_snapshot >"$ARTIFACT_DIR/live-snapshot.after"
  if ! diff -u "$LIVE_SNAPSHOT" "$ARTIFACT_DIR/live-snapshot.after" >&2; then
    die "the live $LIVE_DB_CONTAINER changed during the smoke; do not run any down, report it"
  fi
  log "postflight passed: live $LIVE_DB_CONTAINER unchanged, no smoke resources left"
}

cmd_all() {
  cmd_preflight # fails before any state change
  local status=0
  if bash "$SELF" up; then
    bash "$SELF" check || status=$?
  else
    status=$?
  fi
  bash "$SELF" logs || true
  if ((status != 0)) && [[ "${SMOKE_KEEP_ON_FAILURE:-0}" == 1 ]]; then
    log "smoke failed; stack kept for inspection (SMOKE_KEEP_ON_FAILURE=1). Run '$0 down' afterwards."
    return "$status"
  fi
  bash "$SELF" down || status=1
  bash "$SELF" postflight || status=1
  return "$status"
}

main() {
  local command="${1:-}"
  case "$command" in
    preflight | up | check | logs | down | postflight | all) ;;
    *) die "usage: $0 preflight|up|check|logs|down|postflight|all" ;;
  esac
  acquire_lock
  cd "$ROOT"
  "cmd_$command"
}

main "$@"
