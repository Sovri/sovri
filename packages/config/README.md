<!--
SPDX-License-Identifier: Apache-2.0
Copyright 2026 Sovri SAS
-->

# `@sovri/config`

Parser and validator for `.sovri.yml`. **v0.1 ships only the package
scaffold**; the full schema, loader, and org-override merge logic land in
follow-up tasks.

## Scope

v0.1 (this release):

- Package shape (`@sovri/config`, ESM, Apache 2.0, `workspace:*` wiring).
- A permissive placeholder `SovriConfigSchema` so the workspace graph and
  downstream typecheck wiring are already in place.
- Type-only re-exports of `Severity` (from `@sovri/core`) and `Logger`
  (from `@sovri/observability`) to share the canonical aliases.

Out of scope until follow-up tasks land:

- `loadConfig(repoRoot)` — read `.sovri.yml` from disk and validate.
- `mergeWithOrgOverride(repo, org)` — Cloud-edition override layer.
- The actual config keys (`llm` / `review` / `ignores` / `sarif` /
  `limits`).

## Public API (v0.1 scaffold)

| Export              | Kind       | Stability                              |
| ------------------- | ---------- | -------------------------------------- |
| `SovriConfigSchema` | Zod schema | placeholder — replaced without warning |
| `Severity`          | type alias | re-export of `@sovri/core`             |
| `Logger`            | type alias | re-export of `@sovri/observability`    |

```ts
import { SovriConfigSchema } from "@sovri/config";

const parsed = SovriConfigSchema.parse(someYamlOutput);
```

The scaffold schema is `z.object({}).passthrough()` — any object is
accepted and unknown keys are preserved. The inferred type is `{}` and is
intentionally not surfaced as a named alias; typing downstream code against
that shape today would silently break when the real schema lands.

## Build wiring

Run scripts from the workspace root via
`pnpm --filter @sovri/config <script>` or the matching Turborepo pipeline
(`pnpm turbo run <script>`). Running directly from the package directory
works only inside a `pnpm exec` shell — binaries resolve through the
workspace's pnpm symlink tree, not a per-package devDep.

## References

- `docs/adr/005-zod-runtime-validation.md` — runtime validation policy
- `docs/adr/008-tsup-bundler.md` — bundler choice and tsup config shape
- `docs/adr/010-licence-apache-2.md` — licensing model and header rule
