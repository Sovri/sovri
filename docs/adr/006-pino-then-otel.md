# ADR-006 — Pino from v0.1, OpenTelemetry from v0.5

**Status:** Accepted — OTel milestone revised by ADR-019 (v0.5 → v0.6)
**Date:** 2026-05-12

## Context

Bot observability: structured logging, distributed traces, metrics. Question: do we set up everything from v0.1, or do we start simple and add later?

Alternatives evaluated:

- OTel + Pino from v0.1
- Pino alone in v0.1, OTel added in v0.5
- console.log + Sentry later
- console.log only

## Decision

**Pino alone in v0.1. OpenTelemetry SDK 2.0 added in v0.5 without breaking the `@sovri/observability` package API.**

The `observability` package is sized from v0.1 to absorb the addition of OTel in v0.5 without refactoring application code.

## Rationale

- **Pino is already bundled in Probot**: zero overhead in v0.1.
- **Structured JSON logs to stdout are sufficient for a walking skeleton** running on the maintainer's machine and 1-2 early testers. `docker logs` or `journalctl` largely cover the needs.
- **OTel adds 5+ npm packages, ~50 lines of boilerplate, and a `--require` loading** that complicates local startup. Unjustified cost on a product not yet in production.
- **By v0.5, when the product has first users and incidents start appearing**, OTel becomes necessary — and the cost of addition remains low since application code is not modified.
- **The public API of `@sovri/observability` does not change between v0.1 and v0.5**: `createLogger()` remains the only export used by other packages. Adding OTel happens in `observability/src/telemetry.ts` and in the startup command.
- **Estimated v0.1 savings**: 1 to 2 days of development saved.

## Consequences

- No distributed traces or exported metrics in v0.1.
- v0.1 incidents are debugged by reading stdout logs (`docker logs sovri`) — acceptable at this stage.
- Public API of `@sovri/observability` remains stable between v0.1 and v0.5: `createLogger()` does not change.
- Application code (review-engine, handlers) requires no modification when adding OTel in v0.5.
- In v0.5, addition of `instrumentation.ts` + `telemetry.ts` in `observability`, plus modification of the Docker `CMD` to load `@opentelemetry/auto-instrumentations-node/register` via `--require`.

## Rejected alternatives

- **OTel from v0.1**: real initial overhead (1-2 days), little benefit as long as there are no production incidents. Deferred to v0.5 when first self-host clients start reporting operational issues.
- **console.log + Sentry**: Sentry is a proprietary SaaS tool, poorly aligned with the product's sovereignty positioning. Unacceptable for self-host clients who want to keep their traces in-house.
- **console.log only**: not structured, therefore unusable by self-host clients who want to ingest into their stack (Loki, ELK, etc.). Pino solves this for free.
