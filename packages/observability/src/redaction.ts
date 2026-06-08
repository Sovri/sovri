// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { z } from "zod";

// Telemetry redaction guard for @sovri/observability (docs/adr/019, ARCHI §10.2.2-§10.2.3). One
// allowlist + one pure scrubber that gates every span attribute / metric tag before it reaches an
// OTel span or meter: an off-allowlist key is dropped, a secret-shaped value is censored to the
// shared "[Redacted]" token, and only scalar values pass. Mirrors the REDACT_PATHS discipline in
// logger.ts so logs and telemetry redact consistently.
//
// RED STUB — the allowlist and the public signature are final so the acceptance tests compile and
// fail at runtime for the right reason. GREEN implements the drop / censor / scalar logic and the
// named secret-pattern set.

// The single source of truth for permitted keys: the four span attributes (ARCHI §10.2.2) and the
// nine metric tags (ARCHI §10.2.3). The key type is derived from this enum via z.infer (R-08), so
// adding an attribute or tag means extending the enum, never an ad-hoc bypass.
const AllowedTelemetryKeySchema = z.enum([
  "pr.number",
  "pr.repo",
  "llm.provider",
  "findings.count",
  "status",
  "llm_provider",
  "severity",
  "category",
  "source",
  "provider",
  "model",
  "direction",
  "error_type",
]);

export type AllowedTelemetryKey = z.infer<typeof AllowedTelemetryKeySchema>;

export const ALLOWED_TELEMETRY_KEYS: readonly AllowedTelemetryKey[] =
  AllowedTelemetryKeySchema.options;

/**
 * Drop every off-allowlist key and censor every secret-shaped scalar value to "[Redacted]" before
 * the attribute / tag map reaches a span or meter. Pure, total, deterministic — no I/O, no clock,
 * no random, no throw on malformed input (R-05).
 *
 * RED STUB — returns an empty record so the behavioral acceptance tests fail until GREEN implements
 * the allowlist drop, the secret-pattern censor, and the scalar gate.
 */
export function sanitizeTelemetryAttributes(
  input: Record<string, unknown>,
): Record<string, string | number | boolean> {
  void input;
  return {};
}
