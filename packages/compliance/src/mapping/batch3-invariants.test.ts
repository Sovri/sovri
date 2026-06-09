// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { getCweMap } from "./loader.js";

import { describe, expect, it } from "vitest";

import { type ComplianceMappingEntry, type ComplianceFramework } from "../index.js";

const batchThreeCweIds = [
  "CWE-209",
  "CWE-223",
  "CWE-256",
  "CWE-307",
  "CWE-312",
  "CWE-313",
  "CWE-319",
  "CWE-327",
  "CWE-328",
  "CWE-359",
  "CWE-521",
  "CWE-522",
  "CWE-532",
  "CWE-674",
  "CWE-754",
  "CWE-778",
  "CWE-916",
];

const canonicalConditions = {
  gdpr: "The affected system processes personal data as defined by GDPR Art. 4",
  dora: "The affected system is part of the ICT infrastructure of a financial entity subject to DORA",
  nis2: "The entity is an essential or important entity subject to NIS2",
};

function readEntry(cweId: string): ComplianceMappingEntry {
  const entry = getCweMap().get(cweId);
  if (entry === undefined) {
    throw new TypeError(`Expected ${cweId} to be mapped.`);
  }
  return entry;
}

function referencesFor(
  entry: ComplianceMappingEntry,
  framework: ComplianceFramework,
): ReturnType<typeof entry.references.filter> {
  return entry.references.filter((r) => r.framework === framework);
}

describe("Batch 3 — cross-cutting invariants", () => {
  describe("1. Presence: every batch-3 CWE id is in getCweMap()", () => {
    it.each(batchThreeCweIds)("getCweMap() contains %s", (cweId) => {
      // Arrange + Act
      const map = getCweMap();
      // Assert
      expect(map.has(cweId)).toBe(true);
    });
  });

  describe("2. Applicability: only applicable_if or informational, no confirmed; applicable_if always has a non-empty condition", () => {
    it.each(batchThreeCweIds)(
      "every reference on %s has a valid applicability and a condition when applicable_if",
      (cweId) => {
        // Arrange
        const entry = readEntry(cweId);
        // Act + Assert
        for (const reference of entry.references) {
          expect(["applicable_if", "informational"]).toContain(reference.applicability);
          if (reference.applicability === "applicable_if") {
            expect(reference.condition).toBeDefined();
            expect(reference.condition?.trim()).not.toBe("");
          }
        }
      },
    );
  });

  describe("3. Canonical conditions: GDPR Art. 32, DORA Art. 9, NIS2 applicable_if references use canonical wording", () => {
    it.each(batchThreeCweIds)("canonical condition wording is respected for %s", (cweId) => {
      // Arrange
      const entry = readEntry(cweId);

      // Act — collect applicable_if references per framework
      const gdprArt32ApplicableIf = entry.references.filter(
        (r) =>
          r.framework === "GDPR" &&
          r.identifier === "Art. 32" &&
          r.applicability === "applicable_if",
      );
      const doraArt9ApplicableIf = entry.references.filter(
        (r) =>
          r.framework === "DORA" &&
          r.identifier === "Art. 9" &&
          r.applicability === "applicable_if",
      );
      const nis2ApplicableIf = entry.references.filter(
        (r) => r.framework === "NIS2" && r.applicability === "applicable_if",
      );

      // Assert — each must use the exact canonical wording
      for (const reference of gdprArt32ApplicableIf) {
        expect(reference.condition).toBe(canonicalConditions.gdpr);
      }
      for (const reference of doraArt9ApplicableIf) {
        expect(reference.condition).toBe(canonicalConditions.dora);
      }
      for (const reference of nis2ApplicableIf) {
        expect(reference.condition).toBe(canonicalConditions.nis2);
      }
    });
  });

  describe("4. CWE self-reference: every batch-3 entry has a CWE framework reference with applicability informational", () => {
    it("every batch-3 entry has a CWE self-reference with applicability informational", () => {
      for (const cweId of batchThreeCweIds) {
        // Arrange
        const entry = readEntry(cweId);
        // Act
        const cweRefs = referencesFor(entry, "CWE");
        const selfRef = cweRefs.find(
          (r) => r.identifier === cweId && r.applicability === "informational",
        );
        // Assert
        expect(
          selfRef,
          `${cweId}: expected a CWE self-reference with applicability "informational"`,
        ).toBeDefined();
      }
    });
  });
});
