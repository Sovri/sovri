#!/usr/bin/env bash
# Reject staged imports from apps/cloud-api/ within the Apache 2.0 surface.
# Enforces docs/adr/010-licence-apache-2.md: packages/ and
# apps/community-bot/ MUST NOT import from apps/cloud-api/. The Cloud edition
# may import from the Community edition (one-way), never the reverse.
# Invoked at pre-commit via lefthook.yml.
set -euo pipefail

# Public-surface TypeScript only. Deletions are excluded — removing a stale
# cloud import must pass.
STAGED=$(git diff --cached --diff-filter=d --name-only \
  | grep -E '^(packages/|apps/community-bot/).*\.(ts|tsx)$' || true)
[ -z "$STAGED" ] && exit 0

# Forbidden module specifiers:
#   - @sovri/cloud<anything>       (reserved npm scope for proprietary code)
#   - ../<anything>cloud-api<...>  (relative climb into apps/cloud-api/)
# The relative alternative requires a literal `../` prefix so a sibling
# `./cloud-api-mock` inside packages/ that merely embeds the substring is
# never flagged.
#
# Four import shapes are recognised. All four require the construct to start
# at a real statement boundary (anchored to start-of-line with optional
# leading whitespace) so that string literals, JSDoc and inline comments
# that mention the forbidden specifier are not mistaken for imports:
#
#   1. Single-line `import|export ... from "..."` (incl. `import type`,
#      `export *`, `export type { X } from`)
#   2. Continuation: bare `from "..."` on its own line (after a multi-line
#      destructuring import or re-export)
#   3. Side-effect import: `import "..."` (no `from`, ESM register pattern)
#   4. Dynamic / CJS call: `import("...")` and `require("...")` anywhere on
#      a line, demanding a non-identifier boundary before the keyword so
#      `myImport(x)` / `coreRequire(x)` are not flagged. `\b` is not
#      portable POSIX ERE; we use `(^|[^A-Za-z0-9_$])` instead.
#
# Known limitation: a dynamic import that splits `import(` and the quoted
# specifier across two physical lines slips through. The forthcoming
# pre-push `forbidden-imports` Turbo target (ARCHI.md §15.3) is the heavy
# AST-aware enforcement; this pre-commit gate is a fast defense-in-depth
# layer that catches the common breaches in <50ms.
PATTERN="^[[:space:]]*(import|export)[[:space:]].*from[[:space:]]+['\"](@sovri/cloud|\\.\\./.*cloud-api)|^[[:space:]]*(import|from)[[:space:]]+['\"](@sovri/cloud|\\.\\./.*cloud-api)|(^|[^A-Za-z0-9_\$])(import|require)[[:space:]]*\\([[:space:]]*['\"](@sovri/cloud|\\.\\./.*cloud-api)"

BAD=""
while IFS= read -r file; do
  [ -n "$file" ] || continue
  # Read the staged blob from the index, not the working tree, so a
  # partially-staged file is evaluated exactly as it will land in the
  # commit. Skip only on genuine `git show` failure (e.g. a race with
  # `git restore --staged`); an empty staged blob is still scanned and
  # passes naturally because it contains no imports.
  if ! staged=$(git show ":$file" 2>/dev/null); then
    continue
  fi
  hits=$(printf '%s\n' "$staged" | grep -nE "$PATTERN" || true)
  if [ -n "$hits" ]; then
    BAD="${BAD}${file}
$(printf '%s\n' "$hits" | sed 's/^/  /')
"
  fi
done <<< "$STAGED"

if [ -n "$BAD" ]; then
  echo "BLOCKED: Cloud import in public surface (ADR-010 boundary breach):"
  printf '%s' "$BAD"
  echo ""
  echo "packages/ and apps/community-bot/ MUST NOT import from apps/cloud-api/."
  echo "These directories ship under Apache 2.0 (docs/adr/010-licence-apache-2.md);"
  echo "apps/cloud-api/ is proprietary. The only permitted direction is:"
  echo "  apps/cloud-api/        ->  packages/*               (allowed)"
  echo "  packages/*             ->  apps/cloud-api/          (blocked, this guard)"
  echo "  apps/community-bot/    ->  apps/cloud-api/          (blocked, this guard)"
  echo ""
  echo "Remove the listed import(s)."
  exit 1
fi

exit 0
