#!/usr/bin/env bash
# Reject staged files that introduce competing package managers or lint/format
# toolchains. Sovri standardises on pnpm (ADR-002) and oxlint + oxfmt
# (ADR-011); foreign equivalents must never enter the repo.
# Invoked at pre-commit via lefthook.yml.
set -euo pipefail

MODE="${1:---staged}"
if [ "$MODE" != "--staged" ] && [ "$MODE" != "--all" ]; then
  echo "Usage: ./scripts/no-forbidden-tools.sh [--staged|--all]" >&2
  exit 2
fi

# Deletions are allowed: removing an obsolete `.eslintrc.json` should pass.
if [ "$MODE" = "--all" ]; then
  TARGETS=$(git ls-files)
else
  TARGETS=$(git diff --cached --diff-filter=d --name-only)
fi

[ -z "$TARGETS" ] && exit 0

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

FORBIDDEN=$(printf '%s\n' "$TARGETS" | grep -E "$LOCK_PATTERN|$TOOL_PATTERN" || true)

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
fi

SOURCE_FILES=$(printf '%s\n' "$TARGETS" \
  | grep -E '\.(ts|tsx)$' \
  | grep -Ev '(\.test|\.spec)\.tsx?$' \
  || true)

read_target() {
  local file="$1"
  if [ "$MODE" = "--all" ]; then
    cat "$file" 2>/dev/null || true
  else
    git show ":$file" 2>/dev/null || true
  fi
}

find_source_hits() {
  local pattern="$1"
  local hits=""
  local file content matched

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    content=$(read_target "$file")
    matched=$(printf '%s\n' "$content" | grep -nE "$pattern" || true)
    if [ -n "$matched" ]; then
      hits="${hits}${file}
$(printf '%s\n' "$matched" | sed 's/^/  /')
"
    fi
  done <<< "$SOURCE_FILES"

  printf '%s' "$hits"
}

# Defense-in-depth: a second scan over each source file with comments stripped
# and newlines folded to single spaces. Closes bypass forms that the per-line
# scan can't see, e.g. `value:\nany`, `value:/*x*/any`, `require ("node:fs")`.
# Line numbers are dropped because the offsets no longer reflect the original
# file once it has been normalised; reporting the file path is enough for the
# developer to locate the bypass.
normalize_source() {
  printf '%s' "$1" \
    | sed -E 's@//.*@@' \
    | tr '\n' ' ' \
    | sed -E 's@/\*([^*]|\*[^/])*\*/@ @g' \
    | tr -s '[:space:]' ' '
}

find_source_bypass() {
  local pattern="$1"
  local hits=""
  local file content flat

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    content=$(read_target "$file")
    flat=$(normalize_source "$content")
    if printf '%s' "$flat" | grep -qE "$pattern"; then
      hits="${hits}${file}
  (bypass detected after comment-stripping and line-folding)
"
    fi
  done <<< "$SOURCE_FILES"

  printf '%s' "$hits"
}

TS_PATTERN='@ts-ignore|@ts-expect-error|[:|<,&][[:space:]]*any([^[:alnum:]_]|$)|(^|[^[:alnum:]_])any[[:space:]]*[>|,&]|(^|[^[:alnum:]_])as[[:space:]]+any([^[:alnum:]_]|$)|=>?[[:space:]]*any([^[:alnum:]_]|$)'
COMMONJS_PATTERN='require[[:space:]]*\(|module[[:space:]]*\.[[:space:]]*exports'

TS_ESCAPE_HATCHES=$(find_source_hits "$TS_PATTERN")
TS_ESCAPE_BYPASS=$(find_source_bypass "$TS_PATTERN")
OXLINT_DISABLES=$(find_source_hits 'oxlint-disable')
COMMONJS=$(find_source_hits "$COMMONJS_PATTERN")
COMMONJS_BYPASS=$(find_source_bypass "$COMMONJS_PATTERN")

if [ -n "$TS_ESCAPE_HATCHES" ]; then
  echo "BLOCKED: forbidden TypeScript escape hatches (ADR-001):"
  printf '%s' "$TS_ESCAPE_HATCHES"
  echo ""
  echo "Remove any, @ts-ignore, and @ts-expect-error from production TypeScript sources."
fi

if [ -n "$TS_ESCAPE_BYPASS" ]; then
  echo "BLOCKED: forbidden TypeScript escape hatches (ADR-001) — bypass form:"
  printf '%s' "$TS_ESCAPE_BYPASS"
  echo ""
  echo "Detected only after stripping comments and folding newlines. Reformat the"
  echo "file (oxfmt will normalise it) so the violation is visible to the"
  echo "per-line scan, then remove the offending any/@ts-ignore/@ts-expect-error."
fi

if [ -n "$OXLINT_DISABLES" ]; then
  echo "BLOCKED: oxlint inline disable detected (ADR-011):"
  printf '%s' "$OXLINT_DISABLES"
  echo ""
  echo "Fix the root cause or change the shared oxlint configuration with rationale."
fi

if [ -n "$COMMONJS" ]; then
  echo "BLOCKED: CommonJS detected (ADR-003 ESM only):"
  printf '%s' "$COMMONJS"
  echo ""
  echo "Use ESM import/export syntax in TypeScript sources."
fi

if [ -n "$COMMONJS_BYPASS" ]; then
  echo "BLOCKED: CommonJS detected (ADR-003 ESM only) — bypass form:"
  printf '%s' "$COMMONJS_BYPASS"
  echo ""
  echo "Detected only after stripping comments and folding newlines. Use ESM"
  echo "import/export syntax instead of require()/module.exports."
fi

if [ -n "$FORBIDDEN$TS_ESCAPE_HATCHES$TS_ESCAPE_BYPASS$OXLINT_DISABLES$COMMONJS$COMMONJS_BYPASS" ]; then
  exit 1
fi

exit 0
