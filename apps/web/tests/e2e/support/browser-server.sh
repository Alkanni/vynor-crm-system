#!/bin/sh
# Runs the pinned Playwright browser server for the E2E stack (started by playwright.config.ts).
# The run-server process ignores the SIGTERM docker forwards, so the container is removed here
# when Playwright stops this script, and a container left by an interrupted run is removed first.
set -eu

name=vynor-e2e-browser
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }

cleanup
trap 'cleanup; exit 0' TERM INT

docker run --rm --init --ipc=host --network host --name "$name" \
  -v "$PLAYWRIGHT_CORE_DIR:/opt/playwright-core:ro" \
  "$PLAYWRIGHT_IMAGE" \
  node /opt/playwright-core/cli.js run-server --port "$BROWSER_PORT" --host 127.0.0.1 &
wait $!
