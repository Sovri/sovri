// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri contributors

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const ADR_021_PATH = "docs/adr/021-compliance-only-review-taxonomy.md";
const ADR_022_PATH = "docs/adr/022-project-level-compliance-pivot.md";
const SOURCE_MODEL = "Framework -> Control -> Rule -> Evidence";
const CONFLICT_FAILURE = "conflict between CWE-backed Findings and non-CWE ComplianceGaps";
const MISSING_MAT_112_SCOPE_FAILURE = "MAT-112 output-contract scope is missing";

describe("R-07: ADR-021 and ADR-022 reflect the project compliance output model", () => {
  it("keeps Framework to Control to Rule to Evidence as ADR-022's source model", () => {
    // Given ADR-021 is "docs/adr/021-compliance-only-review-taxonomy.md"
    readProjectFile(ADR_021_PATH);

    // And ADR-022 is "docs/adr/022-project-level-compliance-pivot.md"
    const adr022 = readProjectFile(ADR_022_PATH);

    // When ADR-022 is reviewed
    const sourceModelFailures = prReviewSourceModelFailures(adr022);

    // Then ADR-022 describes "Framework -> Control -> Rule -> Evidence" as the source language
    expect(adr022).toContain(SOURCE_MODEL);

    // And ADR-022 describes "ComplianceGap" as project-level compliance output
    expect(adr022).toContain("ComplianceGap");
    expect(adr022).toContain("project-level compliance output");

    // And ADR-022 says PR review output can project ComplianceGap instances
    expect(adr022).toContain("PR review output can project");
    expect(adr022).toContain("ComplianceGap");

    // And ADR-022 does not describe PR review output as the source model
    expect(sourceModelFailures).toEqual([]);
  });

  it("preserves the CWE-backed Finding path while acknowledging non-CWE gaps in ADR-021", () => {
    // Given ADR-021 is "docs/adr/021-compliance-only-review-taxonomy.md"
    const adr021 = readProjectFile(ADR_021_PATH);

    // And ADR-022 is "docs/adr/022-project-level-compliance-pivot.md"
    readProjectFile(ADR_022_PATH);

    // When ADR-021 is reviewed for the MAT-112 output contract
    const findingCategoryFailures = complianceGapFindingCategoryFailures(adr021);

    // Then ADR-021 preserves security and bug Findings as the CWE-backed review path
    expect(adr021).toContain('"bug"');
    expect(adr021).toContain('"security"');
    expect(adr021).toContain("CWE");
    expect(adr021).toContain("finding");

    // And ADR-021 does not require project compliance gaps to have a CWE
    expect(acknowledgesNonCweComplianceGaps(adr021)).toBe(true);

    // And ADR-021 does not define ComplianceGap as a Finding category
    expect(findingCategoryFailures).toEqual([]);
  });

  it("fails when ADRs require all compliance output to be CWE-backed Findings", () => {
    // Given ADR-021 says "all compliance output must be rendered as CWE-backed Findings"
    const adr021 = "all compliance output must be rendered as CWE-backed Findings";

    // And ADR-022 describes ComplianceGap as project-level output
    const adr022 = "ComplianceGap is project-level compliance output";

    // When the ADR consistency check runs
    const failures = adrConsistencyFailures({ adr021, adr022 });

    // Then the ADR consistency check fails
    expect(failures.length).toBeGreaterThan(0);

    // And the failure identifies the conflict between CWE-backed Findings and non-CWE ComplianceGaps
    expect(failures).toContain(CONFLICT_FAILURE);
  });

  it("fails when ADR-022 omits MAT-112's output-contract scope", () => {
    // Given ADR-022 describes MAT-113 as the rules engine work
    const adr022 = [
      "MAT-113 is the project compliance rules engine work.",
      `MAT-113 owns the core model ${SOURCE_MODEL}.`,
    ].join("\n");

    // And ADR-022 does not describe MAT-112 as the PR/report output contract
    expect(adr022).not.toContain("MAT-112");

    // When the ADR consistency check runs
    const failures = adrConsistencyFailures({ adr021: readProjectFile(ADR_021_PATH), adr022 });

    // Then the ADR consistency check fails
    expect(failures.length).toBeGreaterThan(0);

    // And the failure identifies MAT-112 output-contract scope as missing
    expect(failures).toContain(MISSING_MAT_112_SCOPE_FAILURE);
  });
});

function readProjectFile(path: string): string {
  return readFileSync(join(projectRoot, path), "utf8");
}

function prReviewSourceModelFailures(adr022: string): readonly string[] {
  return /PR review (?:output|findings?) (?:is|are) the source (?:model|compliance model)/i.test(
    adr022,
  )
    ? ["PR review output must be a projection, not the source model"]
    : [];
}

function complianceGapFindingCategoryFailures(adr: string): readonly string[] {
  return /\bComplianceGap\b.{0,80}\bFinding\b.{0,40}\bcategory\b/i.test(adr)
    ? ["ComplianceGap must not be a Finding category"]
    : [];
}

function acknowledgesNonCweComplianceGaps(adr021: string): boolean {
  return /\bnon-CWE\b[^.\n]*\bComplianceGap\b/i.test(adr021);
}

function adrConsistencyFailures({
  adr021,
  adr022,
}: {
  readonly adr021: string;
  readonly adr022: string;
}): readonly string[] {
  const failures: string[] = [];

  if (
    /all compliance output must be rendered as CWE-backed Findings/i.test(adr021) &&
    /\bComplianceGap\b/i.test(adr022) &&
    /\bproject-level\b/i.test(adr022)
  ) {
    failures.push(CONFLICT_FAILURE);
  }

  if (
    /\bMAT-113\b/i.test(adr022) &&
    !/\bMAT-112\b[^.\n]*(?:PR\/report|PR\/review|output contract)/i.test(adr022)
  ) {
    failures.push(MISSING_MAT_112_SCOPE_FAILURE);
  }

  return failures;
}
