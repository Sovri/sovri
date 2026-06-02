# ADR-018 — GitHub Checks API as a bot output surface

**Status:** Accepted
**Date:** 2026-06-02

## Context

The v0.5 design shows a GitHub merge-box with three Sovri check rows: `Sovri / review`, `Sovri / provenance`, and `Sovri / license-scan`. Until now the bot's only output surface is PR comments (the walkthrough and inline findings); the GitHub App manifest does not request `checks: write`.

Check runs put the review verdict and the provenance status where reviewers and branch-protection rules actually look — the merge box — without adding a served HTTP API (the stateless v0.1 constraint forbids a business REST API beyond `/healthz` and the webhook). Check runs are outbound GitHub writes, the same shape as posting a comment, so they do not introduce server state or a new inbound surface.

`license-scan` depends on SARIF consumption, which is a v1.0 capability; v0.5 only has a placeholder for it.

## Decision

The bot adopts the GitHub Checks API as a second output surface and creates exactly three check runs per review: `Sovri / review` (conclusion mapped deterministically from the review verdict — `computeVerdict`, ADR-016), `Sovri / provenance` (reflects whether a signed audit entry exists), and `Sovri / license-scan` (neutral placeholder with explanatory text until SARIF in v1.0). The GitHub App manifest gains the `checks: write` permission. All decision logic stays pure in `@sovri/review-engine` (a `mapChecks` helper); `apps/community-bot` only calls `checks.create`/`checks.update`.

## Rationale

- The merge box is where verdict and provenance are most actionable (branch protection can require the checks); a comment alone cannot gate a merge.
- Reusing `computeVerdict` keeps the `Sovri / review` conclusion identical to the walkthrough header (ADR-016) — one verdict, two surfaces.
- Keeping the mapping pure in review-engine and the bot thin matches the project rule that no review business logic lives in the app layer.
- Check runs are stateless outbound writes; they do not violate the "no business API, stateless bot" constraint.

## Consequences

- The GitHub App manifest (`apps/community-bot/app.yml`) requests `checks: write`; self-hosters re-accept the updated permission on upgrade.
- Three stable check names are part of the bot's public contract; renaming them later is a breaking change for anyone keying branch protection off them.
- `Sovri / license-scan` is neutral until v1.0; it must not report success or failure while SARIF is absent.
- Check creation failures are caught, logged with `delivery_id`, and never crash the webhook; the comment surface remains the source of detail.
- No secrets or raw payloads appear in check output.

## Rejected alternatives

- **Verdict in the walkthrough comment only**: cannot gate merges via branch protection; less visible than the merge box.
- **A served status/REST API**: violates the stateless v0.1 constraint and adds an inbound surface and state.
- **A Commit Status (legacy) instead of Check Runs**: coarser, no rich output/summary, no per-check detail; Check Runs are the modern surface.
- **Implement `license-scan` now**: SARIF consumption is a v1.0 capability; shipping a real license check in v0.5 is out of scope.
