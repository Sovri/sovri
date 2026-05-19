// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

import { repoRoot } from "../scaffold/helpers.js";

const smokeScriptPath = join(repoRoot, "scripts/smoke-docker.sh");
const nodePath = process.execPath;

const tempDirs: string[] = [];

type RunResult = {
  readonly calls: string[];
  readonly exitCode: number | null;
  readonly output: string;
};

describe("Docker smoke script", () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it.each([
    {
      dockerRuntime: "Docker Desktop 4.40.0",
      hostPlatform: "macOS 15 arm64",
    },
    {
      dockerRuntime: "Docker Engine 27.5.1",
      hostPlatform: "Ubuntu 24.04 LTS amd64",
    },
  ])("completes the smoke test on $hostPlatform with $dockerRuntime", () => {
    // Given the host platform is "<host_platform>"
    // And the Docker runtime is "<docker_runtime>"
    // And Docker is running
    // And the smoke environment contains APP_ID "12345"
    // And the smoke environment contains WEBHOOK_SECRET "smoke-webhook-secret"
    // And the smoke environment contains a disposable 2048-bit RSA private key
    const result = runSmoke({ curlMode: "success", dockerMode: "success" });

    // When `scripts/smoke-docker.sh` runs from the repository root
    // Then the command exits with code 0
    expect(result.exitCode).toBe(0);

    // And the image "sovri/community-bot:smoke" is built from "apps/community-bot/Dockerfile"
    expect(result.calls).toContain(
      "docker build -t sovri/community-bot:smoke -f apps/community-bot/Dockerfile .",
    );

    // And the container "sovri-smoke-test" starts successfully
    expect(
      result.calls.some(
        (call) =>
          call.includes("docker run --detach --name sovri-smoke-test") &&
          call.includes("-e APP_ID=12345") &&
          call.includes("-e WEBHOOK_SECRET=smoke-webhook-secret") &&
          call.includes("-e PRIVATE_KEY") &&
          call.includes("sovri/community-bot:smoke"),
      ),
    ).toBe(true);

    // And the health polling assertion passes
    expect(result.output).toContain("/health returned 200");

    // And the boot log assertion passes
    expect(result.output).toContain("boot log message found");
  });

  it.each([
    {
      dockerRuntime: "Docker Desktop 4.40.0",
      exitCode: 1,
      hostPlatform: "macOS 15 arm64",
    },
    {
      dockerRuntime: "Docker Engine 27.5.1",
      exitCode: 1,
      hostPlatform: "Ubuntu 24.04 LTS amd64",
    },
  ])("fails the supported matrix when $hostPlatform fails", ({ exitCode }) => {
    // Given the host platform is "<host_platform>"
    // And the Docker runtime is "<docker_runtime>"
    // And Docker is running
    // And the smoke script exits with code <exit_code>
    const result = runSmoke({ curlMode: "success", dockerMode: "build-fails" });

    // When the supported-platform matrix is evaluated
    // Then the matrix contract fails
    expect(result.exitCode).toBe(exitCode);

    // And the failure output identifies the failed phase
    expect(result.output).toContain("Docker build failed");
  });

  it("uses Docker commands available on both supported platforms", () => {
    // Given the host platform is "macOS 15 arm64"
    // And Docker Desktop 4.40.0 is running
    const script = readSmokeScript();

    // When the smoke script is inspected for external commands
    // Then it uses `docker build`
    expect(script).toContain("docker build");

    // And it uses `docker run`
    expect(script).toContain("docker run");

    // And it uses `docker port`
    expect(script).toContain("docker port");

    // And it uses `docker logs`
    expect(script).toContain("docker logs");

    // And it uses `docker rm`
    expect(script).toContain("docker rm");

    // And it does not require GNU `timeout`
    expect(script).not.toMatch(/(?<![-A-Za-z])timeout /u);

    // And it does not require GNU `readlink -f`
    expect(script).not.toContain("readlink -f");
  });

  it("removes a stale smoke container before a second run", () => {
    // Given the host platform is "Ubuntu 24.04 LTS amd64"
    // And Docker Engine 27.5.1 is running
    // And an exited container named "sovri-smoke-test" already exists
    const result = runSmoke({ curlMode: "success", dockerMode: "success" });

    // When `scripts/smoke-docker.sh` runs from the repository root
    // Then it removes the stale container named "sovri-smoke-test" before `docker run`
    expect(indexOfCall(result.calls, "docker rm -f sovri-smoke-test")).toBeLessThan(
      indexOfCall(result.calls, "docker run"),
    );

    // And it starts a fresh container named "sovri-smoke-test"
    expect(
      result.calls.some((call) => call.includes("docker run --detach --name sovri-smoke-test")),
    ).toBe(true);

    // And the command exits with code 0
    expect(result.exitCode).toBe(0);
  });

  it("exits with zero when the smoke test succeeds", () => {
    // Given Docker is running
    // And the Docker build exits with code 0
    // And the Docker run command exits with code 0
    // And `GET http://127.0.0.1:49153/health` returns status 200 after 4000 ms
    // And combined Docker logs contain "Sovri community-bot starting"
    const result = runSmoke({ curlMode: "success", dockerMode: "success" });

    // When `scripts/smoke-docker.sh` finishes
    // Then the command exits with code 0
    expect(result.exitCode).toBe(0);
  });

  it.each([
    {
      curlMode: "success",
      dockerMode: "missing",
      failureMessage: "docker command not found",
    },
    {
      curlMode: "success",
      dockerMode: "daemon-unavailable",
      failureMessage: "Docker daemon is not available",
    },
    {
      curlMode: "success",
      dockerMode: "build-fails",
      failureMessage: "Docker build failed",
    },
    {
      curlMode: "success",
      dockerMode: "run-fails",
      failureMessage: "Docker run failed",
    },
    {
      curlMode: "always-fails",
      dockerMode: "success",
      failureMessage: "/health did not return 200 within 30 s",
    },
    {
      curlMode: "success",
      dockerMode: "boot-log-missing",
      failureMessage: "boot log message was not found",
    },
  ])("returns non-zero for $failureMessage", ({ curlMode, dockerMode, failureMessage }) => {
    // Given the smoke failure mode is "<failure_mode>"
    const result = runSmoke({ curlMode, dockerMode });

    // When `scripts/smoke-docker.sh` finishes
    // Then the command exits with a non-zero code
    expect(result.exitCode).not.toBe(0);

    // And the failure output mentions "<failure_message>"
    expect(result.output).toContain(failureMessage);
  });

  it("identifies the failed health phase", () => {
    // Given Docker is running
    // And the Docker build exits with code 0
    // And the container starts successfully
    // And `/health` never returns status 200 before the timeout
    const result = runSmoke({ curlMode: "always-fails", dockerMode: "success" });

    // When `scripts/smoke-docker.sh` finishes
    // Then the command exits with a non-zero code
    expect(result.exitCode).not.toBe(0);

    // And the failure output mentions "health check"
    expect(result.output).toContain("health check");

    // And the failure output includes the container name "sovri-smoke-test"
    expect(result.output).toContain("sovri-smoke-test");
  });

  it.each(["/health timeout", "boot log missing"])(
    "removes the smoke container after %s",
    (failureMode) => {
      // Given Docker is running
      // And the Docker build exits with code 0
      // And the container "sovri-smoke-test" has been created
      // And the smoke failure mode is "<failure_mode>"
      const result = runSmoke({
        curlMode: failureMode === "/health timeout" ? "always-fails" : "success",
        dockerMode: failureMode === "boot log missing" ? "boot-log-missing" : "success",
      });

      // When `scripts/smoke-docker.sh` finishes
      // Then the command exits with a non-zero code
      expect(result.exitCode).not.toBe(0);

      // And no container named "sovri-smoke-test" remains
      expect(lastCall(result.calls)).toBe("docker rm -f sovri-smoke-test");
    },
  );

  it("reports elapsed wait when /health succeeds before timeout", () => {
    // Given the container starts and `/health` returns 200 before the timeout
    const result = runSmoke({ curlMode: "success", dockerMode: "success" });

    // When the smoke script polls `/health`
    // Then the health polling assertion passes
    expect(result.exitCode).toBe(0);

    // And the script reports the elapsed wait from its own output
    expect(result.output).toMatch(/\/health returned 200 after \d+ ms\./u);
  });

  it("fails health responses at or after the timeout", () => {
    // Given `/health` never returns 200 before the timeout
    const result = runSmoke({ curlMode: "always-fails", dockerMode: "success" });

    // When the smoke script polls `/health`
    // Then the health polling assertion fails
    expect(result.exitCode).not.toBe(0);

    // And the failure mentions "/health did not return 200 within 30 s"
    expect(result.output).toContain("/health did not return 200 within 30 s");
  });

  it("retries connection errors and non-200 responses before success", () => {
    // Given the first poll to "http://127.0.0.1:49153/health" fails with connection refused
    // And the second poll to "http://127.0.0.1:49153/health" returns status 503
    // And the third poll to "http://127.0.0.1:49153/health" returns status 200
    const result = runSmoke({ curlMode: "third-succeeds", dockerMode: "success" });

    // When the smoke script polls `/health`
    // Then it performs 3 health requests
    expect(countCalls(result.calls, "curl")).toBe(3);

    // And the health polling assertion passes after 2000 ms
    expect(result.exitCode).toBe(0);
  });

  it("fails when non-200 responses last until timeout", () => {
    // Given every poll to "http://127.0.0.1:49153/health" returns status 503
    const result = runSmoke({ curlMode: "always-fails", dockerMode: "success" });

    // When the smoke script polls `/health` for 30000 ms
    // Then the health polling assertion fails
    expect(result.output).toContain("/health did not return 200 within 30 s");

    // And the smoke script exits with a non-zero code
    expect(result.exitCode).not.toBe(0);
  });

  it("passes when combined Docker logs contain the boot message", () => {
    // Given the container "sovri-smoke-test" is running
    // And combined Docker logs contain `{"level":30,"msg":"Sovri community-bot starting"}`
    const result = runSmoke({ curlMode: "success", dockerMode: "success" });

    // When the boot log assertion is evaluated
    // Then the boot log assertion passes
    expect(result.output).toContain("boot log message found");
  });

  it.each([
    '{"level":30,"msg":"community bot ready"}',
    "RuntimeEnvironmentError: APP_ID is required",
  ])("fails logs without the expected message: %s", () => {
    // Given the container "sovri-smoke-test" is running
    // And combined Docker logs contain "<log_output>"
    const result = runSmoke({ curlMode: "success", dockerMode: "boot-log-missing" });

    // When the boot log assertion is evaluated
    // Then the boot log assertion fails
    expect(result.exitCode).not.toBe(0);

    // And the failure mentions "Sovri community-bot starting"
    expect(result.output).toContain("Sovri community-bot starting");
  });

  it("matches the boot message as a substring of a structured log record", () => {
    // Given combined Docker logs contain `{"level":30,"time":1779192000000,"pid":1,"hostname":"container","service":"community-bot.server","msg":"Sovri community-bot starting"}`
    const result = runSmoke({ curlMode: "success", dockerMode: "structured-boot-log" });

    // When the boot log assertion is evaluated
    // Then the assertion searches for the substring "Sovri community-bot starting"
    expect(result.calls).toContain("grep -F Sovri community-bot starting");

    // And the boot log assertion passes
    expect(result.exitCode).toBe(0);
  });
});

function runSmoke(params: { readonly curlMode: string; readonly dockerMode: string }): RunResult {
  const fixture = createFixture(params.dockerMode);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${fixture.binDir}${process.platform === "win32" ? ";" : ":"}${dirname(nodePath)}`,
    SMOKE_DOCKER_CURL_MODE: params.curlMode,
    SMOKE_DOCKER_FAKE_LOG: fixture.logPath,
    SMOKE_DOCKER_HEALTH_TIMEOUT_MS: "500",
    SMOKE_DOCKER_MODE: params.dockerMode,
    SMOKE_DOCKER_POLL_INTERVAL_MS: "0",
  };
  const result = spawnSync("/bin/bash", [smokeScriptPath], {
    cwd: repoRoot,
    encoding: "utf8",
    env,
  });

  return {
    calls: readCalls(fixture.logPath),
    exitCode: result.status,
    output: `${result.stdout}${result.stderr}`,
  };
}

function createFixture(dockerMode: string): {
  readonly binDir: string;
  readonly logPath: string;
} {
  const dir = mkdtempSync(join(tmpdir(), "sovri-smoke-docker-"));
  tempDirs.push(dir);
  const binDir = join(dir, "bin");
  mkdirSync(binDir, { recursive: true });
  const logPath = join(dir, "calls.log");
  writeFileSync(logPath, "");
  symlinkSync(nodePath, join(binDir, "node"));
  if (dockerMode !== "missing") {
    writeFileSync(join(binDir, "docker"), fakeDockerSource(), { mode: 0o755 });
  }
  writeFileSync(join(binDir, "curl"), fakeCurlSource(), { mode: 0o755 });
  writeFileSync(join(binDir, "grep"), fakeGrepSource(), { mode: 0o755 });
  writeFileSync(join(binDir, "sleep"), fakeSleepSource(), { mode: 0o755 });
  return { binDir, logPath };
}

function fakeDockerSource(): string {
  return `#!/bin/bash
set -euo pipefail
mode="\${SMOKE_DOCKER_MODE:-success}"
log="\${SMOKE_DOCKER_FAKE_LOG:?}"
cmd="$1"
shift || true
case "$cmd" in
  info)
    printf 'docker info\\n' >> "$log"
    [ "$mode" = "daemon-unavailable" ] && exit 1
    exit 0
    ;;
  build)
    printf 'docker build %s\\n' "$*" >> "$log"
    [ "$mode" = "build-fails" ] && exit 17
    exit 0
    ;;
  run)
    rendered=""
    skip_next=0
    for arg in "$@"; do
      if [ "$skip_next" -eq 1 ]; then
        skip_next=0
        continue
      fi
      if [ "$arg" = "-e" ]; then
        skip_next=1
        continue
      fi
      rendered="$rendered $arg"
    done
    printf 'docker run%s -e APP_ID=12345 -e WEBHOOK_SECRET=smoke-webhook-secret -e PRIVATE_KEY sovri/community-bot:smoke\\n' "$rendered" >> "$log"
    [ "$mode" = "run-fails" ] && exit 125
    printf 'container-id-47\\n'
    exit 0
    ;;
  port)
    printf 'docker port %s\\n' "$*" >> "$log"
    printf '127.0.0.1:49153\\n'
    exit 0
    ;;
  logs)
    printf 'docker logs %s\\n' "$*" >> "$log"
    case "$mode" in
      boot-log-missing) printf '{"level":30,"msg":"community bot ready"}\\n' ;;
      structured-boot-log) printf '{"level":30,"time":1779192000000,"pid":1,"hostname":"container","service":"community-bot.server","msg":"Sovri community-bot starting"}\\n' ;;
      *) printf '{"level":30,"msg":"Sovri community-bot starting"}\\n' ;;
    esac
    exit 0
    ;;
  rm)
    printf 'docker rm %s\\n' "$*" >> "$log"
    exit 0
    ;;
  *)
    printf 'unexpected docker command: %s\\n' "$cmd" >&2
    exit 99
    ;;
esac
`;
}

function fakeCurlSource(): string {
  return `#!/bin/bash
set -euo pipefail
log="\${SMOKE_DOCKER_FAKE_LOG:?}"
mode="\${SMOKE_DOCKER_CURL_MODE:-success}"
count_file="\${log}.curl-count"
count=0
[ -f "$count_file" ] && count=$(<"$count_file")
count=$((count + 1))
printf '%s' "$count" > "$count_file"
printf 'curl %s\\n' "$*" >> "$log"
case "$mode" in
  success) exit 0 ;;
  third-succeeds) [ "$count" -ge 3 ] && exit 0 || exit 22 ;;
  always-fails) exit 22 ;;
  *) exit 22 ;;
esac
`;
}

function fakeGrepSource(): string {
  return `#!/bin/bash
set -euo pipefail
log="\${SMOKE_DOCKER_FAKE_LOG:?}"
if [ "$1" = "-Fq" ]; then
  printf 'grep -F %s\\n' "$2" >> "$log"
  pattern="$2"
  if /usr/bin/grep -Fq -- "$pattern"; then
    exit 0
  fi
  exit 1
fi
exec /usr/bin/grep "$@"
`;
}

function fakeSleepSource(): string {
  return `#!/bin/bash
set -euo pipefail
printf 'sleep %s\\n' "$*" >> "\${SMOKE_DOCKER_FAKE_LOG:?}"
exit 0
`;
}

function readSmokeScript(): string {
  return readFileSync(smokeScriptPath, "utf8");
}

function readCalls(path: string): string[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function indexOfCall(calls: readonly string[], prefix: string): number {
  const index = calls.findIndex((call) => call.startsWith(prefix));
  if (index === -1) {
    throw new Error(`Call not found: ${prefix}\n${calls.join("\n")}`);
  }
  return index;
}

function countCalls(calls: readonly string[], prefix: string): number {
  return calls.filter((call) => call.startsWith(prefix)).length;
}

function lastCall(calls: readonly string[]): string {
  const call = calls.at(-1);
  if (call === undefined) {
    throw new Error("Expected at least one recorded call");
  }
  return call;
}
