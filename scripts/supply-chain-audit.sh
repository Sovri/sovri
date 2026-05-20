#!/usr/bin/env bash
# Supply-chain audit gate for CI.
set -uo pipefail

pnpm audit --audit-level=high
audit_status=$?

if [ "$audit_status" -ne 0 ]; then
  exit "$audit_status"
fi

printf 'audit_gate=pass\n'
