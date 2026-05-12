# ADR-007 — Vitest + MSW for testing

**Status:** Accepted
**Date:** 2026-05-12

## Context

Testing framework and mocking strategy for Sovri. The bot makes HTTP calls to GitHub and to LLM providers. Tests must be:

- Fast (CI < 1 min on unit tests)
- Network-free (no API key, no quota consumed)
- Easy to write (close to Jest syntax)
- Natively ESM-compatible

Alternatives evaluated: Vitest, Jest, native Node test runner, Mocha + Chai.

## Decision

**Vitest 4 as the runner + MSW 2 for HTTP mocking.**

## Rationale

### Vitest

- **Faster than Jest**: startup in a few seconds vs 10-20s for Jest, especially on large monorepos.
- **Native ESM support**: aligned with ADR-003. No Babel or ts-jest configuration to maintain.
- **Jest-compatible syntax**: `describe`, `it`, `expect`, mocks. Trivial migration to/from Jest if needed.
- **Smart watch mode**: only reruns tests impacted by modified files.
- **Native V8 coverage** via `@vitest/coverage-v8`, no Babel-istanbul to configure.
- **Native TypeScript integration** without prior transpilation.

### MSW

- **Intercepts at the network level** (via `fetch` API and `http` module), not at the SDK level. More realistic than mocking each SDK separately.
- **Allows testing without LLM API key**: no quota consumed, no dependency on an external account in CI.
- **Reusable fixtures**: a mock GitHub payload can serve multiple integration tests.
- **Browser mode available** if we build a frontend later.

## Consequences

- No "real" tests against LLMs in standard CI.
- Separate eval set in nightly from v0.5+: an `evals/` directory with real PRs and golden outputs, run on a nightly CI with real API keys to detect quality regressions.
- Unit tests < 5 seconds on the entire monorepo locally.
- MSW handlers defined in `test/mocks/handlers/` shared between tests.
- Minimum coverage target: 70% on `core`, `review-engine`, `config` (pure logic).

## Rejected alternatives

- **Jest**: slower startup, painful ESM configuration (still under experimental flag in 2026), no rational reason to prefer it to Vitest in 2026 on a new project.
- **Native Node test runner**: interesting for minimalist projects, but less mature matcher and mock ecosystem, less simple coverage integration.
- **Mocha + Chai**: dated, requires more manual configuration, less native TypeScript support.
- **nock** (instead of MSW): popular but MSW handles Service Workers better and has a more modern API. nock remains viable but less ergonomic.
