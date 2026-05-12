# ADR-004 — Probot as GitHub App framework

**Status:** Accepted
**Date:** 2026-05-12

## Context

Sovri is primarily a GitHub App that listens to webhooks and posts reviews. The HTTP framework must handle: webhook reception, HMAC signature validation, GitHub App authentication (JWT + installation tokens), retry on network errors, strict typing of payloads.

Alternatives evaluated: Probot, raw Octokit + Hono, raw Octokit + Express, raw Octokit + Fastify.

## Decision

**Probot v14.**

Actively maintained (regular commits in 2026, 9.5k stars). Official GitHub Apps SDK. Handles JWT + installation tokens, HMAC signature, retry, payload typing via `@octokit/webhooks-types`.

## Rationale

- **Official GitHub Apps SDK**: maintained by GitHub through the Octokit community. No long-term surprises.
- **Handles GitHub App auth end-to-end**: JWT to authenticate as the App, exchange for an installation token per repo, automatic refresh before expiration. Estimated savings: 1-2 months of development on this mechanism alone.
- **Automatic webhook HMAC validation**: built-in protection against unsigned requests.
- **Native TypeScript typing**: `Context<'pull_request.opened'>` provides access to strict payload types.
- **Adapters available** for AWS Lambda, Vercel, Render, Cloud Run, standard Node.js. Allows changing hosting without rewriting the bot.
- **Plugin ecosystem**: `octokit-plugin-config`, `octokit-plugin-throttling`, `octokit-plugin-retry` are production-ready.

## Consequences

- Light lock-in on Probot, but the public API is stable and the community large.
- Possible migration to raw Octokit later: Probot is actually a thin layer over Octokit, business code remains portable.
- Probot imposes the underlying Octokit version — less flexible than raw Octokit but consistent.
- Probot manages its own Pino logger, integrated with `@sovri/observability` (see ADR-006).

## Rejected alternatives

- **Raw Octokit + Hono**: Hono is ultra-fast and edge-ready, but reimplementing GitHub App auth + HMAC validation by hand costs 1-2 months. Little added value since wall-clock time is LLM-bound.
- **Raw Octokit + Express**: mature but also adds the cost of implementing GitHub App auth + HMAC. Express in 2026 is showing its age.
- **Raw Octokit + Fastify**: same as Express with even less reason (Probot already provides everything).
