// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri contributors

import { COMPLIANCE_MIN_CONFIDENCE } from "@sovri/core";
import { describe, expect, it } from "vitest";

import { shouldEnrichCompliance } from "./compliance-gate.js";
import type { ProviderFinding } from "./parsing/index.js";

function finding(overrides: Partial<ProviderFinding> = {}): ProviderFinding {
  return {
    severity: "major",
    category: "security",
    file: "src/app.ts",
    line_start: 1,
    line_end: 1,
    title: "t",
    body: "b",
    recommendation: "r",
    confidence: 1,
    cwe: "CWE-89",
    ...overrides,
  } as ProviderFinding;
}

describe("shouldEnrichCompliance", () => {
  it("pins the threshold at 0.7", () => {
    expect(COMPLIANCE_MIN_CONFIDENCE).toBe(0.7);
  });

  it("enriches a security finding with a CWE at the threshold", () => {
    expect(shouldEnrichCompliance(finding({ confidence: 0.7 }))).toBe(true);
  });

  it("enriches a bug finding with a CWE", () => {
    expect(shouldEnrichCompliance(finding({ category: "bug" }))).toBe(true);
  });

  it("skips when confidence is below the threshold", () => {
    expect(shouldEnrichCompliance(finding({ confidence: 0.69 }))).toBe(false);
  });

  it("skips non-security/bug categories even with a CWE", () => {
    expect(shouldEnrichCompliance(finding({ category: "maintainability" }))).toBe(false);
  });

  it("skips when no CWE is present", () => {
    expect(shouldEnrichCompliance(finding({ cwe: undefined }))).toBe(false);
  });
});
