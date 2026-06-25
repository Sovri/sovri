#!/usr/bin/env bash
# Acceptance tests for scripts/check-runtime.mjs.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$SCRIPT_DIR/check-runtime.mjs"

PASS=0
FAIL=0
FAILURES=""

run_case() {
  local label="$1"
  local node_version="$2"
  local pnpm_version="$3"
  local expected_exit="$4"
  local expected_substring="$5"
  local out ec

  out=$(node --input-type=module <<NODE 2>&1
import { evaluateRuntime } from "$SCRIPT";

const result = evaluateRuntime({
  actualNodeVersion: "$node_version",
  actualPnpmVersion: "$pnpm_version",
  expectedNodeVersion: "24.17.0",
  expectedPackageManager: "pnpm@10.34.4",
});

if (result.ok) {
  console.log(\`Runtime preflight passed (node \${result.nodeVersion}, pnpm \${result.pnpmVersion})\`);
} else {
  for (const error of result.errors) {
    console.error(error);
  }
  process.exitCode = 1;
}
NODE
  ) && ec=0 || ec=$?

  if [ "$ec" -ne "$expected_exit" ]; then
    FAIL=$((FAIL + 1))
    FAILURES="${FAILURES}
  ✗ ${label}: expected exit ${expected_exit}, got ${ec}
$(printf '%s\n' "$out" | sed 's/^/      /')"
    return
  fi

  if ! printf '%s\n' "$out" | grep -Fq -- "$expected_substring"; then
    FAIL=$((FAIL + 1))
    FAILURES="${FAILURES}
  ✗ ${label}: output missing '${expected_substring}'
$(printf '%s\n' "$out" | sed 's/^/      /')"
    return
  fi

  PASS=$((PASS + 1))
}

run_case "matching runtime passes" "24.17.0" "10.34.4" 0 "Runtime preflight passed"
run_case "node mismatch fails" "24.11.1" "10.34.4" 1 "Node.js 24.11.1 does not match .nvmrc 24.17.0"
run_case "pnpm mismatch fails" "24.17.0" "10.33.2" 1 "pnpm 10.33.2 does not match packageManager pnpm@10.34.4"

if [ "$FAIL" -ne 0 ]; then
  printf 'check-runtime tests failed:%s\n' "$FAILURES" >&2
  exit 1
fi

printf 'check-runtime tests passed: %s\n' "$PASS"
