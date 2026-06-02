# ADR-015 — Design system as the @sovri/brand package

**Status:** Accepted
**Date:** 2026-06-02

## Context

The v0.5 sprint codifies the validated visual direction (already live on `sovri.eu`) into a reusable design system, and applies it to the review surface the bot produces on every pull request. The tokens (colour ramps light/dark, spacing, type scale) and the severity/category palettes are consumed in two places that must agree: the review-engine rendering (walkthrough, badges, assessment, provenance) and the repo brand assets (shield, wordmark, EU seal, OG card, README hero).

Putting these tokens inside `@sovri/review-engine` would couple a presentation concern to the review domain and make the brand assets import the review engine. Duplicating them in each consumer guarantees drift between the bot output and the site.

The monorepo dependency rule is strict: `core ← {llm-providers, config, observability} ← review-engine ← apps/*`. A design-system module must be a leaf that anyone can import without pulling the review engine.

## Decision

The design system lives in a new leaf package `@sovri/brand` (Apache 2.0), depending only on `zod`. It exports Zod-validated token sets and `z.infer` types: `ColorTokens` (light and dark, identical key sets), `SpacingScale`, `TypeScale`, `SeverityPalette` (the five `Severity` values), and `CategoryPalette` (the seven `Category` values). `@sovri/review-engine` imports `@sovri/brand`; `@sovri/core` does not.

## Rationale

- A leaf package keeps the dependency graph acyclic and lets both the review engine and the brand-asset generators import one source of truth.
- Zod schemas make the palettes exhaustive-by-construction: a missing or extra severity/category key fails validation, so the bot rendering and the assets can never silently diverge from the `core` enums.
- `zod`-only keeps the supply-chain surface of a new package minimal, consistent with the project's pinning and `ignore-scripts` posture.
- The package is pure data, so it stays out of `@sovri/core` (which must remain free of presentation concerns) while still being importable everywhere else.

## Consequences

- One new published Apache 2.0 package (`@sovri/brand`) with a tsup build, `"type": "module"`, `"sideEffects": false`, and an explicit exports map.
- `SeverityPalette`/`CategoryPalette` keys are bound to the `core` `Severity`/`Category` enums; adding a severity or category requires updating the palette (enforced by the exhaustiveness test).
- Brand asset generators and review-engine rendering (ADR-016) share the same token values.
- The package carries no rendering logic; turning tokens into GitHub-safe markdown is the review-engine's job (ADR-016).

## Rejected alternatives

- **Tokens inside `@sovri/review-engine`**: couples presentation to the review domain and forces brand-asset tooling to import the review engine.
- **Tokens in `@sovri/core`**: `core` is the pure domain and must not carry presentation concerns.
- **Duplicate token constants per consumer**: guarantees drift between the bot output and the public site.
- **A plain `tokens.css` file**: not type-checked, not validated, and unusable as a typed import by the markdown renderers.
