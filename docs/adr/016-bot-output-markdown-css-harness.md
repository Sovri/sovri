# ADR-016 — Bot review output is GitHub Markdown; the CSS design system is a local preview harness

**Status:** Accepted
**Date:** 2026-06-02

## Context

The validated v0.5 visual design renders the bot's pull-request output — verdict banner, severity pills, effort dots, severity distribution bar, suggestion blocks, a compliance/provenance panel — as styled HTML with CSS classes. GitHub, however, sanitizes PR comment bodies: `class` and `style` attributes and `<style>`/external CSS are stripped. Anything the bot posts must survive that sanitizer.

GitHub-flavored Markdown does allow: tables, emoji, shields-style `<img>` badges, `<details>`/`<summary>`, `<img>`/`<picture>` (light/dark via `prefers-color-scheme`), and `mermaid` fenced blocks. The design CSS therefore cannot ship to GitHub, but it is still the visual contract the output must match — and a useful harness to verify that match locally.

The verdict (Approve vs Request changes) is computed once and shown in two surfaces: the walkthrough header and, later, the `Sovri / review` GitHub check (ADR-018). It must not be recomputed differently in each.

## Decision

The bot's review output is GitHub-flavored Markdown only. Visual structure is expressed with emoji, shields-style hosted `<img>` badges, markdown tables, `<details>`/`<summary>`, `<picture>` (light/dark), and `mermaid` — never CSS classes or inline styles. The design CSS is kept only as a local preview and snapshot-test harness, not a shipped artifact.

The verdict and the severity/category badge vocabulary are computed once in `@sovri/review-engine` (`computeVerdict`, `severityBadge`, `categoryBadge`, sourced from `@sovri/brand`) and reused by every surface — the walkthrough, the inline findings, and the GitHub check conclusion.

## Rationale

- GitHub strips CSS, so a CSS-dependent rendering would silently degrade in production. Markdown primitives render identically for every reader.
- `prefers-color-scheme` `<picture>` and emoji give light/dark and severity affordances without CSS.
- A single `computeVerdict` keeps the walkthrough header and the `Sovri / review` check from disagreeing — the failure mode that an independent re-implementation would invite.
- Keeping `gh-chrome.css` as a local harness preserves the design contract: the snapshot tests render the emitted markdown through the CSS in light and dark and lock the structure, so a regression is caught without shipping CSS.

## Consequences

- All review-rendering tasks (badges, verdict/summary, assessment, inline refresh, provenance) emit markdown; none emit CSS or class attributes.
- Hosted images (verdict banner, shields-style badges) need a stable URL; the brand assets (ADR-015) provide them.
- The local snapshot harness is dev-only and adds no runtime dependency to the shipped packages.
- Layouts the design expresses purely in CSS (e.g. exact pill colours, the flow diagram) are approximated with the nearest markdown-safe primitive (emoji/`<img>`, mermaid) rather than reproduced pixel-for-pixel.

## Rejected alternatives

- **Post HTML+CSS comments**: GitHub sanitizes them; the styling would vanish in production.
- **Render to an image and post a screenshot**: inaccessible, unsearchable, breaks `suggestion` blocks and inline anchoring.
- **Recompute the verdict separately in the bot for the check**: invites drift between the comment and the check; the verdict must have one source.
- **Drop `gh-chrome.css` entirely**: loses the visual contract and the ability to snapshot-test the rendered output against the validated design.
