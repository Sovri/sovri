// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { CategorySchema, FindingSchema, SeveritySchema, z } from "@sovri/core";
import { recordMetric, type InstrumentDescriptor } from "@sovri/observability";

// Orchestrator-side half of the Sovri business-metrics registry (docs/adr/019, ARCHI §10.2.3). The
// three metrics emitted around the review.pull_request boundary live here; the two LLM-call metrics
// (sovri.llm.tokens, sovri.llm.errors) are emitted inside the provider adapters (@sovri/llm-providers)
// because error_type can only be class-derived there. Names and tag enums are defined once; callers go
// through the typed wrappers and never string-literal a name or build an ad-hoc tag bag (R-08).

const StatusSchema = z.enum(["succeeded", "failed"]);

// severity/category/source reuse the @sovri/core Finding enums so the tags stay in sync with the
// domain and are never redeclared (R-04, R-10). source has no named export, so it is read off the
// Finding schema shape rather than re-listing its enum values here.
const SourceSchema = FindingSchema.shape.source;

// Unknown tag keys are rejected (strict), so no high-cardinality dimension can slip into a tag (R-02).
const ReviewTotalTagsSchema = z.strictObject({
  status: StatusSchema,
  llm_provider: z.string().min(1),
});
const ReviewDurationTagsSchema = z.strictObject({ llm_provider: z.string().min(1) });
const FindingTagsSchema = z.strictObject({
  severity: SeveritySchema,
  category: CategorySchema,
  source: SourceSchema,
});

export type ReviewTotalTags = z.infer<typeof ReviewTotalTagsSchema>;
export type ReviewDurationTags = z.infer<typeof ReviewDurationTagsSchema>;
export type FindingTags = z.infer<typeof FindingTagsSchema>;
export type ReviewStatus = z.infer<typeof StatusSchema>;

const REVIEWS_TOTAL: InstrumentDescriptor = { name: "sovri.reviews.total", kind: "counter" };
const REVIEWS_DURATION: InstrumentDescriptor = {
  name: "sovri.reviews.duration_ms",
  kind: "histogram",
  unit: "ms",
};
const FINDINGS_TOTAL: InstrumentDescriptor = { name: "sovri.findings.total", kind: "counter" };

// Best-effort: a metrics-backend failure must never surface into or abort the review path (R-09).
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

export function recordReviewTotal(tags: ReviewTotalTags): void {
  const parsed = ReviewTotalTagsSchema.safeParse(tags);
  if (!parsed.success) {
    return;
  }
  safeRecord(REVIEWS_TOTAL, 1, parsed.data);
}

export function recordReviewDuration(tags: ReviewDurationTags, durationMs: number): void {
  const parsed = ReviewDurationTagsSchema.safeParse(tags);
  if (!parsed.success) {
    return;
  }
  safeRecord(REVIEWS_DURATION, durationMs, parsed.data);
}

export function recordFinding(tags: FindingTags): void {
  const parsed = FindingTagsSchema.safeParse(tags);
  if (!parsed.success) {
    return;
  }
  safeRecord(FINDINGS_TOTAL, 1, parsed.data);
}
