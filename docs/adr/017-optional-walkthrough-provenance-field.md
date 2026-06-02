# ADR-017 — Provenance as an optional walkthrough-input field

**Status:** Accepted
**Date:** 2026-06-02

## Context

The v0.5 compliance & provenance block renders, in a collapsible `<details>`, how a review was produced: LLM provider and model, hosting region, data residency, the review prompt `sha256` digest, and a reference to the signed audit-trail entry. The provider and model are already on the `Review` (`llm_provider`, `llm_model`), but the prompt digest and the signed audit-entry reference are not on `ReviewSchema` in `@sovri/core`.

`@sovri/core` must stay a pure domain with zero I/O (ADR rule). The audit trail is off by default in Community (ADR-014): most reviews have no signed entry, and the block must still render cleanly. The digest and audit reference originate in the orchestrator / `AuditTrailSink`, not in the core review value.

## Decision

Provenance is carried by a new optional `provenance` field on the walkthrough input (not on `ReviewSchema`), validated by a `WalkthroughProvenanceSchema` (`prompt_sha256`, `hosting_region`, `data_residency`, optional `signed_audit_entry`). The orchestrator threads it from the audit sink when available. When `provenance` is absent — the Community default — the block renders the model line and states that no signed audit trail is attached. `@sovri/core` is not changed.

## Rationale

- Keeps `@sovri/core` pure: the digest and signed-entry reference are runtime/I/O-derived facts, not part of the review domain value.
- Optionality matches reality: the audit trail is off by default, so a required field would force every Community review to fabricate provenance.
- Validating at the walkthrough boundary (Zod) keeps the rendering total and rejects malformed input (e.g. a non-64-hex `prompt_sha256`) before it reaches the markdown.
- Threading from the orchestrator keeps the producer of the signed entry (the component that owns the Ed25519 key, per ADR-014) as the single source of the provenance facts.

## Consequences

- `WalkthroughInputSchema`/`WalkthroughInput` gain an optional `provenance` field; existing callers that pass none keep working unchanged.
- The provenance block has two shapes: full (trail on) and minimal (trail off); both are covered by tests.
- Provenance never carries secrets — only provider, model, hosting, residency, the digest, and an opaque audit-entry reference; no tokens, prompts, or raw payloads.
- If a future milestone needs provenance on more surfaces (e.g. inline comments), the same optional field is reused rather than duplicated.

## Rejected alternatives

- **Extend `ReviewSchema` in `@sovri/core`**: pushes I/O-derived, audit-specific fields into the pure domain; breaks the purity rule.
- **A required provenance field**: forces fabricated values when the audit trail is off (the Community default).
- **A separate provenance comment**: splits one review's evidence across two comments and complicates reconciliation.
- **Read provenance from a global/singleton at render time**: hidden I/O in a pure renderer; untestable and order-dependent.
