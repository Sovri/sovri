// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri contributors

import { describe, expect, it } from "vitest";

import type { Review } from "@sovri/core";

import {
  buildReviewCheckDescriptors,
  type CheckRunDescriptor,
  type CheckRunName,
} from "./index.js";

describe("buildReviewCheckDescriptors — review state and provenance", () => {
  it("forces the review check to failure when the review status is failed", () => {
    // Given a failed review has no findings
    const review = buildReview({ status: "failed" });

    // When check descriptors are built from the review
    const descriptor = descriptorNamed(buildReviewCheckDescriptors(review), "Sovri / review");

    // Then the "Sovri / review" descriptor conclusion is "failure"
    expect(descriptor.conclusion).toBe("failure");
  });

  it("uses attached signed audit evidence for the provenance check", () => {
    // Given the review has signed audit entry "review-42-entry-3"
    const review = {
      ...buildReview(),
      provenance: {
        signed_audit_entry: "review-42-entry-3",
      },
    };

    // When check descriptors are built from the review
    const descriptor = descriptorNamed(buildReviewCheckDescriptors(review), "Sovri / provenance");

    // Then the "Sovri / provenance" descriptor conclusion is "success"
    expect(descriptor.conclusion).toBe("success");
  });
});

function descriptorNamed(
  descriptors: readonly CheckRunDescriptor[],
  name: CheckRunName,
): CheckRunDescriptor {
  const descriptor = descriptors.find((candidate) => candidate.name === name);
  if (descriptor === undefined) {
    throw new Error(`${name} descriptor not found`);
  }

  return descriptor;
}

function buildReview(values: { readonly status?: Review["status"] } = {}): Review {
  return {
    completed_at: new Date("2026-06-05T00:00:01.000Z"),
    commit_sha: "0123456789abcdef0123456789abcdef01234567",
    findings: [],
    id: "123e4567-e89b-42d3-a456-426614174002",
    llm_model: "test-model",
    llm_provider: "test-provider",
    pr_number: 42,
    repo_full_name: "mpiton/sovri",
    started_at: new Date("2026-06-05T00:00:00.000Z"),
    status: values.status ?? "success",
    summary: "Review complete",
    tokens_used: {
      completion: 20,
      prompt: 100,
    },
    walkthrough_markdown: "Review complete",
  };
}
