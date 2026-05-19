#!/usr/bin/env bash
# Smoke test the Community bot Docker image by building it, starting it with
# disposable credentials, polling /health, and checking the boot log.
set -euo pipefail

IMAGE_TAG="sovri/community-bot:smoke"
CONTAINER_NAME="sovri-smoke-test"
CONTAINER_PORT="3000"
HEALTH_TIMEOUT_MS="${SMOKE_DOCKER_HEALTH_TIMEOUT_MS:-30000}"
POLL_INTERVAL_MS="${SMOKE_DOCKER_POLL_INTERVAL_MS:-1000}"
BOOT_MESSAGE="Sovri community-bot starting"
APP_ID_VALUE="12345"
WEBHOOK_SECRET_VALUE="smoke-webhook-secret"
CONTAINER_CREATED="false"

main() {
  cd_repo_root
  require_docker
  ensure_docker_daemon
  remove_stale_container
  build_image
  run_container
  wait_for_health
  assert_boot_log
  echo "Docker smoke test passed."
}

cd_repo_root() {
  local script_dir
  script_dir="${BASH_SOURCE[0]%/*}"
  cd "${script_dir}/.."
}

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    fail "docker command not found"
  fi
}

ensure_docker_daemon() {
  if ! docker info >/dev/null 2>&1; then
    fail "Docker daemon is not available"
  fi
}

remove_stale_container() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}

build_image() {
  echo "Building $IMAGE_TAG from apps/community-bot/Dockerfile..."
  if ! docker build -t "$IMAGE_TAG" -f apps/community-bot/Dockerfile .; then
    fail "Docker build failed"
  fi
}

run_container() {
  local private_key
  private_key="$(generate_private_key)"

  echo "Starting $CONTAINER_NAME..."
  if ! docker run \
    --detach \
    --name "$CONTAINER_NAME" \
    -p "127.0.0.1::${CONTAINER_PORT}" \
    -e "APP_ID=${APP_ID_VALUE}" \
    -e "WEBHOOK_SECRET=${WEBHOOK_SECRET_VALUE}" \
    -e "PRIVATE_KEY=${private_key}" \
    "$IMAGE_TAG" >/dev/null; then
    fail "Docker run failed"
  fi

  CONTAINER_CREATED="true"
  trap cleanup EXIT
}

generate_private_key() {
  node --input-type=module -e 'import { generateKeyPairSync } from "node:crypto"; const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 }); process.stdout.write(privateKey.export({ type: "pkcs1", format: "pem" }));'
}

wait_for_health() {
  local host_port
  local health_url
  local start_ms
  local elapsed_ms

  host_port="$(resolve_host_port)"
  health_url="http://127.0.0.1:${host_port}/health"
  start_ms="$(now_ms)"

  while true; do
    elapsed_ms=$(( $(now_ms) - start_ms ))
    if [ "$elapsed_ms" -ge "$HEALTH_TIMEOUT_MS" ]; then
      fail "health check failed for ${CONTAINER_NAME}: /health did not return 200 within 30 s"
    fi

    if curl -fsS "$health_url" >/dev/null 2>&1; then
      echo "/health returned 200 after ${elapsed_ms} ms."
      return
    fi

    sleep_interval
  done
}

resolve_host_port() {
  local mapping
  mapping="$(docker port "$CONTAINER_NAME" "${CONTAINER_PORT}/tcp")"
  if [ -z "$mapping" ]; then
    fail "Docker run failed: no host port published for ${CONTAINER_PORT}/tcp"
  fi
  echo "${mapping##*:}"
}

assert_boot_log() {
  local logs
  logs="$(docker logs "$CONTAINER_NAME" 2>&1 || true)"
  if printf '%s\n' "$logs" | grep -Fq "$BOOT_MESSAGE"; then
    echo "boot log message found: $BOOT_MESSAGE"
    return
  fi

  fail "boot log message was not found: $BOOT_MESSAGE"
}

cleanup() {
  if [ "$CONTAINER_CREATED" = "true" ]; then
    docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  fi
}

sleep_interval() {
  if [ "$POLL_INTERVAL_MS" -le 0 ]; then
    return
  fi

  node -e 'const ms = Number(process.argv[1]); setTimeout(() => undefined, ms);' "$POLL_INTERVAL_MS"
}

now_ms() {
  node -e 'process.stdout.write(String(Date.now()))'
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

main "$@"
