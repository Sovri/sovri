// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { getCweMap } from "./loader.js";

import { describe, expect, it } from "vitest";

import {
  ComplianceMappingEntrySchema,
  type ComplianceFramework,
  type ComplianceReferenceEntry,
} from "../index.js";

function reference(
  cweId: string,
  framework: ComplianceFramework,
): ComplianceReferenceEntry | undefined {
  const entry = getCweMap().get(cweId);
  if (entry === undefined) {
    throw new TypeError(`Expected ${cweId} to be mapped.`);
  }
  return entry.references.find((candidate) => candidate.framework === framework);
}

describe("CWE-674 uncontrolled recursion mapping", () => {
  it("maps CWE-674 to DORA Art. 9 as applicable_if", () => {
    expect(reference("CWE-674", "DORA")).toMatchObject({
      identifier: "Art. 9",
      applicability: "applicable_if",
    });
  });
});

describe("CWE-754 improper exception check mapping", () => {
  it("maps CWE-754 to DORA Art. 9 as applicable_if", () => {
    expect(reference("CWE-754", "DORA")).toMatchObject({
      identifier: "Art. 9",
      applicability: "applicable_if",
    });
  });
});

describe("CWE-778 insufficient logging mapping", () => {
  it("maps CWE-778 to NIS2 Art. 21(2)(g) as applicable_if", () => {
    expect(reference("CWE-778", "NIS2")).toMatchObject({
      identifier: "Art. 21(2)(g)",
      applicability: "applicable_if",
    });
  });
});

describe("CWE-223 omission of security-relevant information mapping", () => {
  it("maps CWE-223 to NIS2 Art. 21(2)(g) as applicable_if", () => {
    expect(reference("CWE-223", "NIS2")).toMatchObject({
      identifier: "Art. 21(2)(g)",
      applicability: "applicable_if",
    });
  });
});

describe("applicable_if conditions are non-empty across resilience/logging CWEs", () => {
  it("every applicable_if reference has a non-empty trimmed condition", () => {
    const cweIds = ["CWE-674", "CWE-754", "CWE-778", "CWE-223"];
    for (const cweId of cweIds) {
      const entry = getCweMap().get(cweId);
      const applicableIf =
        entry?.references.filter((r) => r.applicability === "applicable_if") ?? [];
      expect(applicableIf.length).toBeGreaterThan(0);
      for (const r of applicableIf) {
        expect(r.condition?.trim()).not.toBe("");
      }
    }
  });
});

describe("CWE-778 schema rejection", () => {
  it("rejects a CWE-778 entry missing the required NIS2 reference", () => {
    const candidate = {
      cwe_id: "CWE-778",
      title: "Insufficient Logging",
      mitre_url: "https://cwe.mitre.org/data/definitions/778.html",
      impacts: ["x"],
      references: [
        {
          framework: "CWE",
          identifier: "CWE-778",
          description: "Insufficient Logging",
          source_url: "https://cwe.mitre.org/data/definitions/778.html",
          applicability: "informational",
        },
      ],
    };
    const result = ComplianceMappingEntrySchema.safeParse(candidate);
    expect(result.success).toBe(false);
    const failureText = result.success ? "" : result.error.issues.map((i) => i.message).join("\n");
    expect(failureText).toContain("CWE-778");
    expect(failureText).toContain("NIS2");
  });
});
