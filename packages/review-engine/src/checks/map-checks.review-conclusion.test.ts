// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri contributors

import { describe, expect, it } from "vitest";

import { mapChecks, type CheckRunDescriptor } from "./index.js";

function reviewDescriptor(descriptors: readonly CheckRunDescriptor[]): CheckRunDescriptor {
  const descriptor = descriptors.find((candidate) => candidate.name === "Sovri / review");
  if (descriptor === undefined) {
    throw new Error("Sovri / review descriptor not found");
  }

  return descriptor;
}

describe("GitHub Checks descriptors — review conclusion mapping (R-02)", () => {
  it.each([
    {
      verdict: "approve",
      label: "Approve",
      findingCount: 0,
      conclusion: "success",
    },
    {
      verdict: "comment",
      label: "Comment",
      findingCount: 2,
      conclusion: "neutral",
    },
    {
      verdict: "request-changes",
      label: "Request changes",
      findingCount: 1,
      conclusion: "failure",
    },
  ])(
    "maps verdict $verdict with $findingCount findings to $conclusion",
    ({ verdict, label, findingCount, conclusion }) => {
      // Given the review verdict is "<verdict>"
      // And the review has <finding_count> findings
      // And no signed audit entry is available
      const input = {
        verdict: { kind: verdict, label },
        findingCount,
        hasSignedAuditEntry: false,
      };

      // When the Sovri check descriptors are mapped
      const descriptor = reviewDescriptor(mapChecks(input));

      // Then the "Sovri / review" descriptor conclusion is "<conclusion>"
      expect(descriptor.conclusion).toBe(conclusion);

      // And its summary mentions "<finding_count> finding"
      expect(descriptor.summary).toContain(`${String(findingCount)} finding`);
    },
  );

  it("rejects an unmodelled verdict at the mapping boundary", () => {
    // Given a caller supplies the review verdict "manual-review"
    // And the review has 1 finding
    const input = {
      verdict: { kind: "manual-review", label: "Manual review" },
      findingCount: 1,
      hasSignedAuditEntry: false,
    };

    // When the Sovri check descriptors are mapped
    // Then the input is rejected by validation
    // And no check descriptor is returned
    expect(() => mapChecks(input)).toThrow();
  });
});
