# ADR-011 — oxlint + oxfmt for TypeScript/JavaScript lint and format

**Status:** Accepted
**Date:** 2026-05-12

## Context

Sovri ships strict TypeScript code across a pnpm monorepo (`packages/*` + `apps/*`). The toolchain needs a linter and a formatter that:

- Enforce a consistent style across contributors and CI.
- Catch common bug classes (unused variables, missing returns, unsafe equality, dead branches) before they reach review.
- Run fast enough to be invoked from a pre-commit hook without disrupting the developer loop (target: full repo scan under 500 ms).
- Have no plugin ecosystem dependency that would expand the supply-chain attack surface — a real concern after the mini-shai-hulud attack of May 11, 2026 (TanStack, Mistral SDK, OpenSearch SDK compromised).
- Cover plain TypeScript / Node without needing framework-specific plugins (no React, no Next.js, no Vue in the v1 scope).
- Allow disabling rules via configuration only, not via inline source comments (see ADR-011 §Decision below).

Alternatives evaluated: ESLint + typescript-eslint + Prettier, Biome, oxlint + oxfmt, Deno fmt / lint, dprint.

## Decision

**`oxlint` + `oxfmt` are the sole linter and formatter on Sovri.**

- `oxlint` >= 0.13, pinned to an exact minor in `package.json`.
- `oxfmt` >= 0.x, pinned to an exact minor in `package.json`.
- Configuration files: `.oxlintrc.json` and `.oxfmtrc.json` at the repo root, no per-package override (a single ruleset across the workspace).
- Disable rules **at the configuration level only**. Inline disables (`oxlint-disable`, `oxlint-disable-next-line`) are forbidden and rejected by CI (`forbidden-tools` job, defined in ADR-012).
- ESLint, Prettier, Biome, dprint, and any related config file (`.eslintrc*`, `.prettierrc*`, `biome.json*`) are forbidden in the repo and rejected by `scripts/no-forbidden-tools.sh` at pre-commit, and by the CI `forbidden-tools` job.

The lint and format gates run:

- **Locally** at pre-commit on staged files (`{staged_files}` glob via lefthook, defined in ADR-012).
- **In CI** as `pnpm exec oxlint . --max-warnings=0` and `pnpm exec oxfmt --check .` (as part of the `backend-checks` CI job, defined in ADR-012).

## Rationale

- **Speed**: oxlint and oxfmt are written in Rust and process the full Sovri monorepo (estimated ~50k LOC at v1.0) in under 500 ms. ESLint + typescript-eslint + Prettier on a comparable monorepo takes 20–60 s, which makes pre-commit hooks slow enough that developers start bypassing them. oxlint and oxfmt make `--no-verify` an unattractive shortcut.
- **No plugin ecosystem**: oxlint ships a fixed set of rules compiled into the binary. There is no `eslint-plugin-*` to audit, version, or compromise. This matches the supply-chain stance from ADR-010 §Consequences (post mini-shai-hulud attack of May 11, 2026).
- **Coverage sufficient for Sovri's scope**: oxlint already implements the bulk of the `eslint:recommended` + `typescript-eslint/recommended` rules that matter for a strict-TS Node backend. The rules that oxlint does not yet implement (mostly framework-specific React/Vue/Next plugins) are not relevant to Sovri's v1 scope.
- **One project, one toolchain**: oxlint and oxfmt are developed in the same `oxc` repository, share parser and AST infrastructure, and have aligned release cadence. ESLint + Prettier require coordinating two independent project release schedules, with periodic compatibility issues (eslint-config-prettier, etc.).
- **TypeScript-aware out of the box**: no `parser` configuration, no `parserOptions.project`, no separate `tsconfig.json` reference dance. oxlint reads the TS code directly.
- **Single binary**: installed as a regular npm dependency, no native build step. Works identically on Linux, macOS, and Windows CI runners.

## Consequences

- **Tight binding to oxc maturity**: oxlint and oxfmt are young projects (first public release in late 2024). Sovri's lint coverage is whatever oxlint supports today. We accept this trade-off because the v1 scope (TS backend, no UI framework) is precisely the area where oxlint is the most mature.
- **No automatic migration path from existing ESLint configs**: if a contributor opens a PR with `.eslintrc.json`, CI rejects it. The `.oxlintrc.json` must be authored manually. As of the v0.1 walking skeleton, the config will be minimal (oxlint defaults + a small allowlist of project-specific exceptions).
- **No inline disables**: a rule that breaks legitimate code must be turned off at the config level, with a documented justification in a comment within `.oxlintrc.json`. This forces conscious, repo-wide trade-offs instead of file-by-file paper cuts.
- **oxc upstream tracking**: Sovri commits to upgrading oxlint and oxfmt at least once per minor Sovri release (every 6–8 weeks), to absorb new rules and bug fixes. The exact version bumps are tracked via Dependabot/Renovate with the same 7-day delay rule as any other dependency.
- **If oxc stalls**: if the project is abandoned, falls behind on a critical CVE, or fails to support a future Sovri requirement (e.g. a UI framework added in v2), a future ADR will supersede this one — most likely toward Biome (closest equivalent in terms of speed and single-toolchain philosophy) or back to ESLint + Prettier with a hardened plugin allowlist.

## Rejected alternatives

- **ESLint + typescript-eslint + Prettier**: industry default, mature, broad ecosystem. Rejected on three grounds: (1) wall-clock speed makes pre-commit hooks bypass-tempting, (2) the plugin ecosystem is a supply-chain surface we are unwilling to expand, (3) the operational cost of coordinating ESLint, Prettier, eslint-config-prettier, and a dozen plugins is high for a project Sovri's size.
- **Biome**: closest competitor to oxlint + oxfmt in terms of speed and single-toolchain philosophy. Rejected because, at the time of decision (May 2026), Biome's TypeScript rule coverage and stability are roughly equivalent to oxlint, and oxlint has a slightly more aggressive roadmap on diagnostics oxc shares with the formatter. The decision is reversible if Biome's trajectory accelerates and oxc stalls.
- **Deno fmt / lint**: excellent inside the Deno ecosystem, but Sovri targets Node 24 LTS (ADR-001). Adopting Deno tooling on a Node project means installing Deno just for fmt/lint, which is not a sensible trade-off.
- **dprint**: focused on formatting only, would still leave the linter question open. Sovri prefers a single tool family for both concerns.
- **No formatter, just lint**: rejected — diff churn from inconsistent formatting wastes reviewer attention. A formatter is non-negotiable.
- **No linter, just types**: rejected — TypeScript's type system catches a different class of bugs than a linter. Both are needed.
