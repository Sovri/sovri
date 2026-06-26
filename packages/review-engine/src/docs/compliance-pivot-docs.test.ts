// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri contributors

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const adrDocsRoot = new URL("docs/adr/", `file://${repoRoot}`);

const requiredDefinitions = [
  {
    term: "ComplianceGap",
    meaning: "project-level compliance output for an unmet control or missing evidence",
  },
  {
    term: "ControlResult",
    meaning: "result of evaluating a control against its rules and collected evidence",
  },
  {
    term: "Control",
    meaning: "framework requirement that the project must satisfy",
  },
  {
    term: "Rule",
    meaning: "technical verification attached to a control",
  },
  {
    term: "Evidence",
    meaning: "collected proof or observation used to support a control result or compliance gap",
  },
  {
    term: "FrameworkReference",
    meaning: "versioned framework citation with official text or source URL from a catalog",
  },
] as const;

function readDocs(): string {
  return readdirSync(adrDocsRoot)
    .filter((docPath) => docPath.endsWith(".md"))
    .map((docPath) => readFileSync(new URL(docPath, adrDocsRoot), "utf8"))
    .join("\n");
}

function findDefinitionLine(docs: string, term: string): string | undefined {
  return docs.split(/\r?\n/).find((line) => line.includes(`**${term}**`));
}

describe("MAT-80 compliance pivot vocabulary docs", () => {
  it("defines each required project-level compliance term explicitly", () => {
    // When the compliance vocabulary is reviewed
    const docs = readDocs();

    for (const { term, meaning } of requiredDefinitions) {
      const definitionLine = findDefinitionLine(docs, term);
      const definitionText = definitionLine ?? "";

      // Then the term "<term>" is defined with the meaning "<meaning>"
      expect(definitionText, `${term} must be defined with meaning: ${meaning}`).toContain(meaning);

      // And the definition does not describe "<term>" as an enum-only review category
      expect(definitionText).not.toContain("enum-only review category");
      expect(definitionText).not.toContain("finding category");
      expect(definitionText).not.toContain("category emitted by PR review");
    }
  });
});
