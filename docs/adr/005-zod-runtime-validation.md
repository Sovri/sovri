# ADR-005 — Zod 4 for runtime validation

**Status:** Accepted
**Date:** 2026-05-12

## Context

Sovri handles three external uncontrolled data flows that must be strictly validated at runtime:

1. **GitHub webhooks**: HMAC-signed payloads but structure must be strictly validated.
2. **LLM responses**: non-deterministic generation, must be parsed as `Finding[]` according to a precise schema.
3. **`.sovri.yml` file**: user configuration, potentially malformed YAML.

Alternatives evaluated: Zod, Valibot, ArkType, manual validation, JSON Schema + Ajv.

## Decision

**Zod v4.**

All data contracts go through a Zod schema. TypeScript types are **inferred** from the schema (`z.infer<typeof Schema>`), ensuring a single source of truth.

## Rationale

- **De facto standard in the TypeScript ecosystem in 2026**: the most widely used, best documented, best maintained.
- **Native integration with LLM SDKs**: Mistral SDK v2 uses Zod v4 internally, Anthropic SDK accepts Zod schemas via `response_format` mode.
- **Type inference from the schema**: single source of truth, no drift between TS type and runtime validation.
- **Massive ecosystem**: `zod-to-json-schema` (to generate JSON Schemas to pass to LLMs), `zod-to-openapi` (if we build an API later), `@hono/zod-validator`, etc.
- **Actionable error messages**: `result.error.format()` returns a structure usable for user messages or structured logs.

## Consequences

- Slightly larger npm footprint than Valibot (~75 KB minified vs ~10 KB for Valibot), but acceptable server-side.
- Uniform pattern throughout the code: `Schema.parse(data)` or `Schema.safeParse(data)`.
- All business types (`Finding`, `Review`, `PullRequest`, `SovriConfig`) are derived from Zod schemas.
- Allows generating JSON Schema to pass as `response_format` to LLMs via `zod-to-json-schema`.

## Rejected alternatives

- **Valibot**: lighter (~10 KB), similar syntax, but significantly smaller ecosystem. No native integration with LLM SDKs.
- **ArkType**: better performance than Zod, but nascent ecosystem in 2026, fewer plugins available.
- **JSON Schema + Ajv**: faster at runtime but separates TS type from validation (double maintenance), less ergonomic in TypeScript.
- **Manual validation**: invariably a source of bugs, no guarantee of exhaustiveness, painful refactoring.
