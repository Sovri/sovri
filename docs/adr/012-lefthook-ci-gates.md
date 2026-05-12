# ADR-012 — Lefthook + non-negotiable CI gates

**Status:** Accepted
**Date:** 2026-05-12

## Context

Sovri's target market is EU regulated enterprises (banks, healthcare, defense, public sector). For a CISO/DPO review of a third-party code reviewer, the engineering process itself is part of the product:

- Every change to `packages/*` and `apps/community-bot/` is auditable from `main` history.
- No human can land code that violates a documented architectural rule (e.g. ADR-010 Community/Cloud boundary, ADR-003 ESM only, supply-chain hygiene captured in ADR-010 and the CI gates section below).
- Local development feedback must be fast enough that contributors do not bypass it.

Two independent layers are needed:

1. **Local layer (Git hooks)**: catches violations before the developer pushes. Fast feedback, low cost, but technically bypassable (`--no-verify`).
2. **CI layer (GitHub Actions)**: catches violations before merge. Cannot be bypassed by branch protection rules. Slower, higher cost.

The two layers must enforce the **same rules** so that a green local commit predicts a green CI run. Divergence between local and CI checks creates frustration and erodes hook adoption.

Alternatives evaluated for the local hook manager: husky, simple-git-hooks, pre-commit (Python), lefthook, native `.git/hooks/` scripts.

For CI, the choice is GitHub Actions by construction (Sovri Community is hosted on GitHub, the bot is a GitHub App). The question for CI is the **set of gates** to make non-negotiable.

## Decision

**Lefthook is the sole local Git hook manager. The CI pipeline enforces a fixed set of non-negotiable gates that mirror the local hooks.**

### Local hooks (lefthook)

- `lefthook.yml` at repo root, single source of truth for both `pre-commit` and `pre-push`.
- Installed via `./scripts/install-hooks.sh` (delegates to `pnpm exec lefthook install`).
- All hooks run in **parallel** by default; failure of any one fails the commit/push.
- `--no-verify` (and equivalents `--no-verify-signatures`, `core.hooksPath=/dev/null`) is **forbidden by policy** (documented in `CLAUDE.md`, `CONTRIBUTING.md`). There is no technical block — the contract is social and reinforced by CI replicating every hook.
- Full hook list and rationale: see `lefthook.yml` at the repo root.

### CI gates (GitHub Actions)

Branch protection on `main` makes the following statuses required and non-overridable except by repo admins:

- `backend-checks` (oxlint + oxfmt + tsc + vitest + coverage gates)
- `knip` (unused exports / files / deps)
- `supply-chain` (`pnpm audit --audit-level=high`, license whitelist, `pnpm dedupe --check`, SBOM CycloneDX)
- `secrets-scan` (filename pattern reject + API key pattern grep + Gitleaks)
- `forbidden-tools` (no `package-lock.json` / `yarn.lock` / `bun.lockb` / ESLint / Prettier / Biome / `@ts-ignore` / inline `any`)
- `forbidden-imports` (ADR-010 Community/Cloud boundary)
- `build-docker` (multi-arch Docker build of `apps/community-bot` + Trivy scan)
- `changelog-check` (`CHANGELOG.md` updated on any `.ts`/`.tsx` diff in PRs)
- `CodeQL` (GitHub Advanced Security, security-extended queries, weekly schedule)
- `Dependency Review` (license deny-list at PR time)

Full pipeline definition: see `.github/workflows/ci.yml`.

### Reciprocity

Every rule rejected by CI also has a local hook in `lefthook.yml`. Every local hook also has a CI counterpart. New rules are added to **both layers simultaneously**; a future ADR or amendment is required if a rule deliberately exists in one layer only.

### Exception procedure

The only documented way to bypass a hook or a CI gate is via a maintainer-approved exception logged in a `CONTRIBUTING.md` procedure, and tracked by a follow-up issue. This is intended for true emergencies (prod hotfix) and not as a routine workaround.

## Rationale

- **Lefthook's binary form**: lefthook is distributed as a single Go binary, installed via `pnpm exec lefthook install`. It does not depend on a particular Node version to manage hook scripts. The hook scripts themselves are shell or `node` commands that lefthook orchestrates.
- **Parallel execution**: lefthook runs hook commands in parallel by default, which keeps the pre-commit/pre-push duration close to the duration of the slowest single command. On a typical Sovri commit, pre-commit takes 1–3 seconds, pre-push takes 30–90 seconds.
- **`{staged_files}` injection**: lefthook passes the list of staged files matching a glob to the command, so oxlint runs only on touched files at commit time. This keeps the dev feedback loop tight.
- **Glob scoping**: each command declares the glob it applies to (`**/*.{ts,tsx}` for lint, `{package.json}` for the deps guard). A commit that touches only `*.md` does not pay the lint cost.
- **One YAML, not many shell scripts**: husky scatters hooks across `.husky/pre-commit`, `.husky/pre-push`, with each file being a bespoke shell script. lefthook centralizes the declaration in `lefthook.yml`, which is easier to review and diff.
- **CI gates as architectural enforcement**: a documented architectural rule (ADR-010 boundary, ADR-003 ESM only) that is not enforced by an automated check decays. Every ADR with a mechanical verification has a corresponding CI gate; this is the contract that makes architecture documentation operational rather than aspirational.
- **Mirroring local and CI**: the only way to ensure that a green commit predicts a green CI run is to enforce exactly the same rules at both layers. Any divergence creates frustration ("it passes on my machine") that destroys hook adoption.
- **Enterprise audit posture**: for a CISO reviewing Sovri, `lefthook.yml` and `.github/workflows/ci.yml` are auditable artifacts that demonstrate that every architectural rule has a mechanical enforcement.

## Consequences

- **Onboarding friction**: a new contributor must run `./scripts/install-hooks.sh` once. If they skip it, their first push will fail CI with the same diagnostics — but with a 5–10 minute round-trip instead of a 30-second local check.
- **Hook duration grows with the project**: pre-push runs the full test suite. As Sovri grows, this duration will grow. Mitigation: keep tests fast by construction (no real network, MSW everywhere, parallel Vitest by default). If pre-push duration exceeds ~3 minutes consistently, split into `pre-push` (fast subset) and `pre-merge` (full suite, server-side) — to be revisited via a follow-up ADR.
- **CI cost predictable**: the gates listed above run within ~15 minutes on a free GitHub Actions runner. For Sovri Community (public OSS repo), this is free. For Cloud (private repo, future), the cost will be predictable at GitHub's standard rates.
- **`--no-verify` is policy, not a block**: a contributor who deliberately bypasses the local hooks will be caught by CI. There is no realistic threat model where a malicious local bypass survives review and CI. The local hooks are an ergonomics tool, not a security boundary.
- **Adding a new gate is a deliberate act**: a new rule requires editing both `lefthook.yml` and `.github/workflows/ci.yml`, plus a CHANGELOG entry. This friction is intentional — the goal is a small, stable, justified set of gates rather than a sprawling, ad-hoc collection.
- **Drift detection**: a future audit can compare `lefthook.yml` and `ci.yml` to verify reciprocity. Initially manual; if Sovri grows, a small custom check can be added as a CI job.

## Rejected alternatives

- **husky**: most common Git hook manager in the Node ecosystem. Rejected because (1) hook scripts are scattered across `.husky/pre-commit`, `.husky/pre-push`, each being a bespoke shell script that drifts over time, (2) no native parallelization — commands run sequentially unless wrapped in `&` and `wait`, (3) no glob scoping, (4) no `{staged_files}` injection, requires `lint-staged` as an additional dependency.
- **simple-git-hooks**: minimal, zero-dependency, declares hooks in `package.json`. Rejected because (1) no parallelization, (2) no glob scoping, (3) no `{staged_files}` injection, (4) the simplicity becomes a liability as the hook set grows.
- **pre-commit (Python)**: excellent tool with a strong ecosystem of community-maintained hooks. Rejected because (1) it requires Python on every developer machine, which adds an onboarding step to an otherwise Node-only project, (2) Sovri does not benefit from the pre-commit community hook catalog because most relevant tools (oxlint, oxfmt, tsc, vitest, knip, pnpm) do not have official pre-commit hooks and would need wrapper scripts anyway.
- **Native `.git/hooks/` scripts**: cannot be checked into the repo without symlinking. The setup ergonomics are poor, and contributors who clone the repo without running an install step have no hooks at all.
- **CI-only (no local hooks)**: rejected because the round-trip on a CI failure is 5–10 minutes, which is expensive for a fast iteration loop. Local hooks make most failures visible in 1–5 seconds.
- **Local hooks only (no CI gates)**: rejected because local hooks are bypassable by `--no-verify` and have no chain of custody. CI is the only authoritative enforcement layer.
- **Soft warnings instead of hard fails**: rejected. A "warning" that does not block a merge is ignored within weeks of being introduced. Gates are binary: pass or fail.
