// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri contributors

import { z } from "@sovri/core";
import { recordMetric, type InstrumentDescriptor } from "@sovri/observability";

import type { StructuredGeneration } from "./types/LLMProvider.js";

// Provider-side half of the Sovri business-metrics registry (docs/adr/019, ARCHI §10.2.3). The two
// metrics emitted inside the adapters live here, not in @sovri/review-engine, because the dependency
// rule is review-engine -> llm-providers and because error_type can only be class-derived at the
// adapter, before the orchestrator flattens a provider error to a message. Names and tag enums are
// defined once; callers go through the typed wrappers and never string-literal a name (R-08).

const DirectionSchema = z.enum(["prompt", "completion"]);
const ErrorTypeSchema = z.enum(["auth", "response", "retry", "timeout", "unknown"]);

// Unknown tag keys are rejected (strict), so no high-cardinality dimension can slip into a tag (R-02).
const LlmTokensTagsSchema = z.strictObject({
  provider: z.string().min(1),
  model: z.string().min(1),
  direction: DirectionSchema,
});
const LlmErrorTagsSchema = z.strictObject({
  provider: z.string().min(1),
  error_type: ErrorTypeSchema,
});

export type LlmTokensTags = z.infer<typeof LlmTokensTagsSchema>;
export type LlmErrorTags = z.infer<typeof LlmErrorTagsSchema>;
export type LlmErrorType = z.infer<typeof ErrorTypeSchema>;

const LLM_TOKENS: InstrumentDescriptor = { name: "sovri.llm.tokens", kind: "counter" };
const LLM_ERRORS: InstrumentDescriptor = { name: "sovri.llm.errors", kind: "counter" };

// Best-effort: a metrics-backend failure must never surface into the LLM call path (R-09).
function safeRecord(
  descriptor: InstrumentDescriptor,
  value: number,
  tags: Record<string, string>,
): void {
  try {
    recordMetric(descriptor, value, tags);
  } catch {
    // Metrics are side-channel; swallow so review output is identical with metrics on or off.
  }
}

export function recordLlmTokens(tags: LlmTokensTags, tokens: number): void {
  const parsed = LlmTokensTagsSchema.safeParse(tags);
  if (!parsed.success) {
    return;
  }
  safeRecord(LLM_TOKENS, tokens, parsed.data);
}

export function recordLlmError(tags: LlmErrorTags): void {
  const parsed = LlmErrorTagsSchema.safeParse(tags);
  if (!parsed.success) {
    return;
  }
  safeRecord(LLM_ERRORS, 1, parsed.data);
}

// Maps a typed provider error to a low-cardinality error_type, derived from the error CLASS name —
// never the message or cause — so no provider/user content reaches the tag (R-07). The name patterns
// cover every provider's Auth/Response/Retry/Timeout class; anything else is "unknown".
export function llmErrorType(error: unknown): LlmErrorType {
  const name = error instanceof Error ? error.name : "";
  if (name.includes("Auth")) {
    return "auth";
  }
  if (name.includes("Timeout")) {
    return "timeout";
  }
  if (name.includes("Retry")) {
    return "retry";
  }
  if (name.includes("Response") || name.includes("ProviderError")) {
    return "response";
  }
  return "unknown";
}

// Wraps a usage-aware generation so adapters stay thin: on success emits sovri.llm.tokens once per
// direction tagged with the provider's own name/model; on failure emits sovri.llm.errors with the
// class-derived error_type, then rethrows the original error unchanged.
export async function withLlmMetrics<T>(
  context: { readonly provider: string; readonly model: string },
  run: () => Promise<StructuredGeneration<T>>,
): Promise<StructuredGeneration<T>> {
  try {
    const generation = await run();
    recordLlmTokens(
      { provider: context.provider, model: context.model, direction: "prompt" },
      generation.tokenUsage.prompt,
    );
    recordLlmTokens(
      { provider: context.provider, model: context.model, direction: "completion" },
      generation.tokenUsage.completion,
    );
    return generation;
  } catch (error) {
    recordLlmError({ provider: context.provider, error_type: llmErrorType(error) });
    throw error;
  }
}
