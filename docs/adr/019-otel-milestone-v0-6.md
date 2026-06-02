# ADR-019 — OpenTelemetry instrumentation deferred to v0.6

**Status:** Accepted
**Date:** 2026-06-02
**Revises:** ADR-006 (OpenTelemetry milestone only; the Pino-from-v0.1 decision stands)

## Context

ADR-006 set Pino from v0.1 and OpenTelemetry "from v0.5", on the assumption that v0.5 would be the productization milestone where first self-host users surface incidents. The roadmap has since been renumbered: the BYOK productization (providers, `.sovri.yml`, commands, committable suggestions, cost footer) landed in the v0.4 line, and v0.5 is now the public design sprint (design system + bot review-comment rendering). OTel and the `/metrics` endpoint did not ship with productization and are the remaining observability residual.

ADR-006 is accepted and not edited on substance; the milestone needs to move without rewriting that record.

## Decision

OpenTelemetry SDK 2.0 instrumentation and the `/metrics` endpoint are delivered in **v0.6** ("Observability & telemetry completion"), not v0.5. The substance of ADR-006 is unchanged: Pino remains the v0.1 logger, `@sovri/observability` keeps a stable `createLogger()` API, and OTel is still added via `instrumentation.ts` + `telemetry.ts` plus the Docker `--require` startup hook — only the target milestone changes from v0.5 to v0.6.

## Rationale

- v0.5 was reassigned to the design sprint; OTel has no dependency on the design work and would dilute that sprint.
- The observability residual (OTel + `/metrics`) is a coherent, short milestone of its own, with a clear exit criterion (a review emits usable traces/metrics, `/metrics` responds, no secrets in telemetry).
- ADR-006's design choice — Pino first, OTel deferred, stable package API — is unaffected; only the calendar moves, so a revision pointer is cleaner than a full supersession.

## Consequences

- The product roadmap and the toolchain overview reference v0.6 and this ADR for the OTel milestone.
- ADR-006 carries a status pointer to this ADR; its Context/Decision/Consequences text is preserved as the historical record.
- No code or package-API change versus ADR-006: the observability package is still sized to absorb OTel without touching application code.
- SARIF consumption is unaffected and remains a v1.0 capability.

## Rejected alternatives

- **Edit ADR-006 in place**: violates the ADR discipline (an accepted ADR is not changed on substance).
- **Fully supersede ADR-006**: overstates the change — only the milestone moved, not the Pino/OTel architecture.
- **Keep OTel in v0.5**: forces observability work into the design sprint it has no relationship with.
- **Drop the `/metrics` endpoint**: leaves the productization line without exported metrics, contradicting the v0.4 exit goal of incident-ready operation.
