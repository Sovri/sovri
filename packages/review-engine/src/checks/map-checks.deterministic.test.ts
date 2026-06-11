// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri contributors

import { afterEach, describe, expect, it, vi } from "vitest";

import { mapChecks } from "./index.js";

function serializeMappedChecks(input: unknown): string {
  return JSON.stringify(mapChecks(input));
}

describe("GitHub Checks descriptors - deterministic mapping (R-03)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns byte-identical descriptor arrays for identical inputs", () => {
    // Given the review verdict is "comment"
    // And the review has 3 findings
    // And a signed audit entry is available
    const input = {
      verdict: { kind: "comment", label: "Comment" },
      findingCount: 3,
      hasSignedAuditEntry: true,
    };

    // When the Sovri check descriptors are mapped twice
    const firstDescriptors = serializeMappedChecks(input);
    const secondDescriptors = serializeMappedChecks(input);

    // Then the first descriptor array equals the second descriptor array byte-for-byte
    expect(firstDescriptors).toBe(secondDescriptors);
  });

  it("does not depend on wall-clock time", () => {
    // Given the review verdict is "approve"
    // And the review has 0 findings
    // And no signed audit entry is available
    const input = {
      verdict: { kind: "approve", label: "Approve" },
      findingCount: 0,
      hasSignedAuditEntry: false,
    };

    vi.useFakeTimers();

    // And the system clock reads "2026-06-04T10:00:00.000Z"
    vi.setSystemTime(new Date("2026-06-04T10:00:00.000Z"));

    // When the Sovri check descriptors are mapped
    const firstDescriptors = serializeMappedChecks(input);

    // And the system clock later reads "2026-06-04T10:05:00.000Z"
    vi.setSystemTime(new Date("2026-06-04T10:05:00.000Z"));

    // And the same Sovri check descriptors are mapped again
    const secondDescriptors = serializeMappedChecks(input);

    // Then both descriptor arrays are byte-identical
    expect(firstDescriptors).toBe(secondDescriptors);
  });
});
