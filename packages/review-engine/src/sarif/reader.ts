// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { z } from "@sovri/core";

/**
 * Raised when a SARIF report is rejected whole: not valid JSON, a `version`
 * other than the exact string `2.1.0`, or a top-level shape that does not match
 * the SARIF 2.1.0 log structure. The original failure (a `SyntaxError` from
 * `JSON.parse`, or a `ZodError`) is preserved as `cause` for diagnostics.
 */
export class SarifParseError extends Error {
  public override readonly name = "SarifParseError";

  public constructor(message: string, options?: { readonly cause?: unknown }) {
    super(message, options);
  }
}

// Minimal SARIF 2.1.0 surface needed for R-01 acceptance. The reader validates
// untrusted external input at the boundary, so every nested object is tolerant
// (`passthrough`) of the many optional fields later rules consume. `$schema` is
// optional and ignored for acceptance (Trivy and older Semgrep omit it);
// `runs` may be empty and `run.results` may be absent (notifications-only run).
export const SarifResultSchema = z.looseObject({});

export const SarifRunSchema = z.looseObject({
  results: z.array(SarifResultSchema).optional(),
});

export const SarifLogSchema = z.looseObject({
  version: z.literal("2.1.0"),
  $schema: z.string().optional(),
  runs: z.array(SarifRunSchema),
});

export type SarifLog = z.infer<typeof SarifLogSchema>;
export type SarifRun = z.infer<typeof SarifRunSchema>;
export type SarifResult = z.infer<typeof SarifResultSchema>;

/**
 * Validate one untrusted SARIF report string and return the parsed SARIF 2.1.0
 * log. Throws {@link SarifParseError} when the string is not valid JSON, the
 * `version` is not exactly `2.1.0`, or the top-level shape is invalid.
 */
export function parseSarifReport(_raw: string): SarifLog {
  throw new Error("parseSarifReport: not implemented (RED)");
}
