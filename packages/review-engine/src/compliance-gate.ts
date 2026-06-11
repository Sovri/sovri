// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri contributors

import { COMPLIANCE_MIN_CONFIDENCE, type Category } from "@sovri/core";

import type { ProviderFinding } from "./parsing/index.js";

// Only security and bug findings are eligible for compliance enrichment. Other categories are
// excluded even when the model tags them with a CWE, so regulatory references never attach to
// style or maintainability findings (ADR-013).
const COMPLIANCE_ELIGIBLE_CATEGORIES: ReadonlySet<Category> = new Set(["security", "bug"]);

export function shouldEnrichCompliance(finding: ProviderFinding): boolean {
  return (
    COMPLIANCE_ELIGIBLE_CATEGORIES.has(finding.category) &&
    finding.cwe !== undefined &&
    finding.confidence >= COMPLIANCE_MIN_CONFIDENCE
  );
}
