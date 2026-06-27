// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri contributors

import { describe, expect, it } from "vitest";

import * as reviewEngine from "./index.js";

const cataloguedControl = {
  control_id: "gdpr-eprivacy-consent-tracking",
  framework_reference: "GDPR Art. 5(1)(a)",
  source_url: "https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng",
  remediation_guidance: "Delay non-essential analytics until consent is recorded",
} as const;
const catalog = [cataloguedControl];

describe("Uncatalogued gaps stay out of regulatory output", () => {
  it("excludes an uncatalogued gap from PR and report output", () => {
    // Given the catalog contains control "gdpr-eprivacy-consent-tracking"
    // And the catalog does not contain control "gdpr-cookie-banner-copy-review"
    // Given a ComplianceGap "gap-uncatalogued-001"
    // And the gap references control "gdpr-cookie-banner-copy-review"
    // And the gap has evidence "web/app/cookies.tsx:44 renders ambiguous consent copy"
    // And the gap has status "WARNING"
    // And the gap has severity "minor"
    const gap = {
      id: "gap-uncatalogued-001",
      control_id: "gdpr-cookie-banner-copy-review",
      evidence: "web/app/cookies.tsx:44 renders ambiguous consent copy",
      status: "WARNING",
      severity: "minor",
    };

    // When the PR output is rendered
    const pullRequestOutput = expectString(
      callExport("renderComplianceGapPullRequestOutput", gap, {
        catalog,
        changed_files: ["web/app/cookies.tsx"],
        relations: [{ gap_id: "gap-uncatalogued-001", file: "web/app/cookies.tsx" }],
      }),
    );

    // Then the PR output does not show "gap-uncatalogued-001"
    expect(pullRequestOutput).not.toContain("gap-uncatalogued-001");

    // And the PR output does not show a GDPR or ePrivacy claim for "gdpr-cookie-banner-copy-review"
    expectNoRegulatoryClaimFor(pullRequestOutput, "gdpr-cookie-banner-copy-review");

    // When the project report output is rendered
    const projectReportOutput = expectString(
      callExport("renderComplianceGapProjectReportOutput", gap, { catalog }),
    );

    // Then the project report does not show "gap-uncatalogued-001"
    expect(projectReportOutput).not.toContain("gap-uncatalogued-001");

    // And the project report does not show a GDPR or ePrivacy claim for "gdpr-cookie-banner-copy-review"
    expectNoRegulatoryClaimFor(projectReportOutput, "gdpr-cookie-banner-copy-review");
  });

  it("retains an uncatalogued gap as an internal diagnostic", () => {
    // Given the catalog contains control "gdpr-eprivacy-consent-tracking"
    // And the catalog does not contain control "gdpr-cookie-banner-copy-review"
    // Given a ComplianceGap "gap-uncatalogued-002"
    // And the gap references control "gdpr-cookie-banner-copy-review"
    // And the gap has evidence "web/app/cookies.tsx:44 renders ambiguous consent copy"
    // And the gap has status "WARNING"
    // And the gap has severity "minor"
    const gap = {
      id: "gap-uncatalogued-002",
      control_id: "gdpr-cookie-banner-copy-review",
      evidence: "web/app/cookies.tsx:44 renders ambiguous consent copy",
      status: "WARNING",
      severity: "minor",
    };

    // When internal compliance diagnostics are rendered
    const diagnostics = expectString(
      callExport("renderInternalComplianceDiagnostics", gap, { catalog }),
    );

    // Then the diagnostics show "gap-uncatalogued-002"
    expect(diagnostics).toContain("gap-uncatalogued-002");

    // And the diagnostics show "uncatalogued control reference"
    expect(diagnostics).toContain("uncatalogued control reference");

    // And the diagnostics do not describe the gap as a regulatory violation
    expect(diagnostics).not.toContain("regulatory violation");
  });

  it("excludes a gap with no control reference from regulatory output and retains it diagnostically", () => {
    // Given the catalog contains control "gdpr-eprivacy-consent-tracking"
    // And the catalog does not contain control "gdpr-cookie-banner-copy-review"
    // Given a ComplianceGap "gap-uncatalogued-004"
    // And the gap has no control id
    // And the gap has no framework reference
    // And the gap has evidence "web/app/cookies.tsx:44 renders ambiguous consent copy"
    // And the gap has status "WARNING"
    // And the gap has severity "minor"
    const gap = {
      id: "gap-uncatalogued-004",
      evidence: "web/app/cookies.tsx:44 renders ambiguous consent copy",
      status: "WARNING",
      severity: "minor",
    };

    // When the project report output is rendered
    const projectReportOutput = expectString(
      callExport("renderComplianceGapProjectReportOutput", gap, { catalog }),
    );

    // Then the project report does not show "gap-uncatalogued-004"
    expect(projectReportOutput).not.toContain("gap-uncatalogued-004");

    // And the project report does not show a GDPR or ePrivacy claim for "gap-uncatalogued-004"
    expectNoRegulatoryClaimFor(projectReportOutput, "gap-uncatalogued-004");

    // When internal compliance diagnostics are rendered
    const diagnostics = expectString(
      callExport("renderInternalComplianceDiagnostics", gap, { catalog }),
    );

    // Then the diagnostics show "gap-uncatalogued-004"
    expect(diagnostics).toContain("gap-uncatalogued-004");

    // And the diagnostics show "missing catalogued control reference"
    expect(diagnostics).toContain("missing catalogued control reference");
  });

  it("fails publication when an uncatalogued gap is published as a regulatory claim", () => {
    // Given the catalog contains control "gdpr-eprivacy-consent-tracking"
    // And the catalog does not contain control "gdpr-cookie-banner-copy-review"
    // Given a ComplianceGap "gap-uncatalogued-003"
    // And the gap references control "gdpr-cookie-banner-copy-review"
    // And the catalog has no framework reference for "gdpr-cookie-banner-copy-review"
    const gap = {
      id: "gap-uncatalogued-003",
      control_id: "gdpr-cookie-banner-copy-review",
    };

    // When the project report output is rendered
    const evaluation = expectPlainObject(
      callExport("evaluateComplianceGapPublishability", gap, {
        catalog,
        report_output: "GDPR requires gdpr-cookie-banner-copy-review",
      }),
    );

    // Then the report publication check fails if the report shows "GDPR requires gdpr-cookie-banner-copy-review"
    expect(Reflect.get(evaluation, "output_contract_check")).toBe("failed");

    // And the failure explains that regulatory claims require catalogued control references
    expect(Reflect.get(evaluation, "explanation")).toContain(
      "regulatory claims require catalogued control references",
    );
  });
});

function callExport(name: string, ...args: readonly unknown[]): unknown {
  const exported: unknown = Reflect.get(reviewEngine, name);
  expect(exported, `${name} export is missing`).toBeTypeOf("function");

  if (typeof exported !== "function") {
    throw new TypeError(`${name} export is not callable`);
  }

  return Reflect.apply(exported, undefined, args);
}

function expectString(value: unknown): string {
  expect(value).toEqual(expect.any(String));

  if (typeof value !== "string") {
    throw new TypeError("Expected a string");
  }

  return value;
}

function expectPlainObject(value: unknown): object {
  expect(value).toEqual(expect.any(Object));

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Expected a plain object");
  }

  return value;
}

function expectNoRegulatoryClaimFor(output: string, subject: string): void {
  const escapedSubject = escapeRegExp(subject);
  expect(output).not.toMatch(new RegExp(`(?:GDPR|ePrivacy).*${escapedSubject}`, "u"));
  expect(output).not.toMatch(new RegExp(`${escapedSubject}.*(?:GDPR|ePrivacy)`, "u"));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
