// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

type ExplicitImportExample = {
  readonly calledApis: readonly string[];
  readonly file: string;
  readonly importedApis: readonly string[];
};

const explicitImportExamples: readonly ExplicitImportExample[] = [
  {
    calledApis: ["describe", "expect", "it"],
    file: "packages/core/src/index.test.ts",
    importedApis: ["describe", "expect", "it"],
  },
  {
    calledApis: ["describe", "expect", "it"],
    file: "packages/review-engine/test/scaffold.test.ts",
    importedApis: ["describe", "expect", "it"],
  },
  {
    calledApis: ["describe", "expect", "it", "vi"],
    file: "apps/community-bot/tests/handlers/pull-request.delegation.test.ts",
    importedApis: ["describe", "expect", "it", "vi"],
  },
  {
    calledApis: ["afterAll", "afterEach", "beforeAll", "describe", "expect", "it", "vi"],
    file: "packages/llm-providers/src/providers/AnthropicProvider.test.ts",
    importedApis: ["afterAll", "afterEach", "beforeAll", "describe", "expect", "it", "vi"],
  },
];

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

function readVitestConfig(): string {
  return readRepoFile("vitest.config.ts");
}

function extractVitestImports(source: string): Set<string> {
  const imports = new Set<string>();
  const matches = source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']vitest["']/gu);
  for (const match of matches) {
    const importList = match[1] ?? "";
    for (const name of importList.split(",")) {
      const importedName = name
        .trim()
        .split(/\s+as\s+/u)[0]
        ?.trim();
      if (importedName !== undefined && importedName.length > 0) {
        imports.add(importedName);
      }
    }
  }
  return imports;
}

describe("Vitest root config explicit import policy", () => {
  it.each(explicitImportExamples)("keeps explicit imports in $file", (example) => {
    // Given "vitest.config.ts" sets "test.globals" to false
    const config = readVitestConfig();
    expect(config).toContain("globals: false");
    // And "vitest.config.ts" documents "Vitest globals stay disabled; tests import APIs from vitest"
    expect(config).toContain("Vitest globals stay disabled; tests import APIs from vitest");
    // And "<file>" calls "<called_apis>"
    const source = readRepoFile(example.file);
    for (const api of example.calledApis) {
      expect(source).toContain(api);
    }
    // And "<file>" imports "<imported_apis>" from "vitest"
    const imports = extractVitestImports(source);
    expect([...imports].toSorted()).toEqual([...example.importedApis].toSorted());
    // When the Vitest API style rule is evaluated
    // Then the Vitest API style assertion passes
    for (const api of example.calledApis) {
      expect(imports.has(api)).toBe(true);
    }
  });
});
