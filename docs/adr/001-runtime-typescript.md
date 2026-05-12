# ADR-001 — Node.js LTS + strict TypeScript

**Status:** Accepted
**Date:** 2026-05-12

## Context

Choice of runtime and language for the Sovri bot. The bot receives GitHub webhooks, calls LLMs, parses diffs, and posts reviews. Latency is dominated by LLM calls (>95% of wall-clock time). Enterprise target: banks, healthcare, defense, regulated EU public sector.

Alternatives evaluated: Node.js, Bun, Deno, Rust.

## Decision

**Node.js LTS 24+ with strict TypeScript 5.7+.**

TypeScript configuration:

- `strict: true`
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`
- `noImplicitOverride: true`

## Rationale

- Probot and Octokit (ADR-004) are written for Node.js and tested exclusively on it.
- Strict TypeScript ensures the contract with LLM providers via Zod (ADR-005).
- Node LTS is expected by Enterprise CISOs, accepted without question during security audits.
- Rust would be technically superior but dramatically slows time-to-market for webhook handling, especially when >95% of time is spent waiting on the LLM.
- Bun has 90% Node compatibility but remains an additional variable to defend during a CISO audit. To reconsider later for specific workers.
- Deno lacks the complete npm ecosystem and requires wrappers for Probot/Octokit.

## Consequences

- No raw performance guarantee (acceptable, latency is LLM-bound).
- Large npm attack surface: compensated by the supply-chain measures listed in ADR-010 and enforced by the CI gates in ADR-012 (`pnpm audit`, license whitelist, SBOM, `ignore-scripts`, signed images).
- Rust remains an option for auxiliary workers post-v1.0 (AST parsing, embeddings).
- Strict TypeScript adds initial cost but prevents entire classes of runtime bugs.

## Rejected alternatives

- **Bun**: alternative runtime, attack surface and residual incompatibilities with Probot/Octokit. To reconsider post-v1.0.
- **Deno**: incomplete npm ecosystem via compatibility layer, requires wrappers.
- **Rust**: excellent for performance and memory safety, but drastically slows time-to-market on webhook handling. Remains an option for specialized workers post-v1.0.
