#!/usr/bin/env bash
# Reject staged files that introduce competing package managers or lint/format
# toolchains. Sovri standardises on pnpm (ADR-002) and oxlint + oxfmt
# (ADR-011); foreign equivalents must never enter the repo.
# Invoked at pre-commit via lefthook.yml.
set -euo pipefail

# Deletions are allowed: removing an obsolete `.eslintrc.json` should pass.
STAGED=$(git diff --cached --diff-filter=d --name-only)
[ -z "$STAGED" ] && exit 0

# Forbidden package-manager lockfiles (ADR-002). `pnpm-lock.yaml` is the only
# accepted lockfile and is NOT matched here.
LOCK_PATTERN='(^|/)(package-lock\.json|yarn\.lock|bun\.lockb)$'

# Forbidden lint/format tool configs (ADR-011). The four families come straight
# from the ADR-011 §Decision list and from issue #9. Patterns:
#   .eslintrc*    → .eslintrc, .eslintrc.json, .eslintrc.js, .eslintrc.cjs, .eslintrc.yaml, ...
#   biome.json*   → biome.json, biome.jsonc
#   .prettierrc*  → .prettierrc, .prettierrc.json, .prettierrc.js, ...
#   .prettier.*   → .prettier.config.js, .prettier.ignore, ...
# The `.prettier.` alternative requires at least one character after the dot
# (`[^/]+`) — a bare `.prettier.` is not a real Prettier config and matching
# it would only add noise.
# Each alternative is anchored to a path-component boundary so a file named
# `notes/eslintrc-history.md` (no leading dot) is not flagged, while
# `apps/x/.eslintrc.json` is.
TOOL_PATTERN='(^|/)(\.eslintrc[^/]*|biome\.json[^/]*|\.prettierrc[^/]*|\.prettier\.[^/]+)$'

FORBIDDEN=$(printf '%s\n' "$STAGED" | grep -E "$LOCK_PATTERN|$TOOL_PATTERN" || true)

if [ -n "$FORBIDDEN" ]; then
  echo "BLOCKED: forbidden tool files staged:"
  printf '%s\n' "$FORBIDDEN" | sed 's/^/  - /'
  echo ""
  echo "Sovri uses pnpm (ADR-002) and oxlint + oxfmt (ADR-011) exclusively."
  echo ""
  echo "Forbidden package-manager lockfiles (ADR-002):"
  echo "  - package-lock.json, yarn.lock, bun.lockb  →  use pnpm-lock.yaml"
  echo ""
  echo "Forbidden lint/format configs (ADR-011):"
  echo "  - .eslintrc*                                →  use .oxlintrc.json"
  echo "  - biome.json*                               →  use .oxlintrc.json + .oxfmtrc.json"
  echo "  - .prettierrc*, .prettier.*                 →  use .oxfmtrc.json"
  echo ""
  echo "Remove the listed file(s) and use the ADR-approved tools."
  echo "If you need a dependency, run \`pnpm add <pkg>\` so pnpm-lock.yaml is the"
  echo "only lockfile in the repo."
  exit 1
fi

exit 0
