#!/usr/bin/env bash
# Acceptance tests for scripts/supply-chain-audit.sh.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$SCRIPT_DIR/supply-chain-audit.sh"

PASS=0
FAIL=0
FAILURES=""

run_pnpm_audit_failure_case() {
  local temp_dir fake_bin stdout_file stderr_file stdout stderr ec

  temp_dir=$(mktemp -d)
  fake_bin="$temp_dir/pnpm"
  stdout_file=$(mktemp)
  stderr_file=$(mktemp)

  cat >"$fake_bin" <<'SH'
#!/usr/bin/env bash
if [ "$1" = "audit" ] && [ "$2" = "--audit-level=high" ]; then
  printf 'high severity vulnerability GHSA-high-0002\n' >&2
  exit 1
fi

printf 'unexpected pnpm invocation: %s\n' "$*" >&2
exit 2
SH
  chmod +x "$fake_bin"

  # Given `pnpm audit --audit-level=high` exits with status 1
  # And the audit output reports 1 high vulnerability named "GHSA-high-0002"
  PATH="$temp_dir:$PATH" "$SCRIPT" >"$stdout_file" 2>"$stderr_file" && ec=0 || ec=$?

  stdout=$(cat "$stdout_file" 2>/dev/null || true)
  stderr=$(cat "$stderr_file" 2>/dev/null || true)
  rm -rf "$temp_dir"
  rm -f "$stdout_file" "$stderr_file"

  # When the supply-chain job runs the audit gate
  # Then the supply-chain job fails
  if [ "$ec" -ne 1 ]; then
    FAIL=$((FAIL + 1))
    FAILURES="${FAILURES}
  x pnpm audit high-threshold failure: expected exit 1, got ${ec}
      stdout:
$(printf '%s\n' "$stdout" | sed 's/^/        /')
      stderr:
$(printf '%s\n' "$stderr" | sed 's/^/        /')"
    return
  fi

  if ! printf '%s\n' "$stderr" | grep -Fq "GHSA-high-0002"; then
    FAIL=$((FAIL + 1))
    FAILURES="${FAILURES}
  x pnpm audit high-threshold failure: missing named vulnerability output
$(printf '%s\n' "$stderr" | sed 's/^/        /')"
    return
  fi

  # And the job does not report the audit gate as successful
  if printf '%s\n' "$stdout" | grep -Fq "audit_gate=pass"; then
    FAIL=$((FAIL + 1))
    FAILURES="${FAILURES}
  x pnpm audit high-threshold failure: unexpected audit gate pass marker
$(printf '%s\n' "$stdout" | sed 's/^/        /')"
    return
  fi

  PASS=$((PASS + 1))
}

run_pnpm_audit_failure_case

if [ "$FAIL" -ne 0 ]; then
  printf 'supply-chain-audit tests: %s passed, %s failed\n%s\n' "$PASS" "$FAIL" "$FAILURES" >&2
  exit 1
fi

printf 'supply-chain-audit tests: %s passed, %s failed\n' "$PASS" "$FAIL"
