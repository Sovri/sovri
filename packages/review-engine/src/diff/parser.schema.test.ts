// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { DiffSchema } from "@sovri/core";
import { describe, expect, it } from "vitest";

import { DiffParseError, mapParsedDiffFiles, parseUnifiedDiff } from "./parser.js";

const UnknownFileSha = "0000000000000000000000000000000000000000";

describe("parseUnifiedDiff schema validation", () => {
  it("returns a DiffSchema-valid object for a textual unified diff", () => {
    const raw = `diff --git a/src/app.ts b/src/app.ts
index 1111111111111111111111111111111111111111..2222222222222222222222222222222222222222 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,2 +1,3 @@
 export const name = "sovri";
+export const enabled = true;
 export const mode = "review";`;

    // Given the raw unified diff above.
    // When the maintainer parses the diff.
    const diff = parseUnifiedDiff(raw);

    // Then the returned value validates against `DiffSchema`.
    expect(DiffSchema.parse(diff)).toEqual(diff);
    expect(diff.unified_diff).toBe(raw);
    expect(diff.files).toHaveLength(1);
    expect(diff.files[0]).toMatchObject({
      path: "src/app.ts",
      status: "modified",
      sha: "2222222222222222222222222222222222222222",
    });
  });

  it("rejects invalid mapped output before returning a partial Diff", () => {
    // Given the parse-diff output contains a file with an empty path.
    const parsedOutput = [
      {
        chunks: [],
        deletions: 0,
        additions: 0,
        from: "",
        to: "",
        index: [
          "1111111111111111111111111111111111111111..2222222222222222222222222222222222222222",
        ],
      },
    ];

    // When the maintainer maps the parsed file into `DiffSchema`.
    const result = () => mapParsedDiffFiles(parsedOutput, "diff --git a/ b/");

    // Then parsing fails with a `DiffParseError`.
    expect(result).toThrow(DiffParseError);
    try {
      result();
    } catch (error) {
      expect(error).toBeInstanceOf(DiffParseError);
      expect(error).toHaveProperty("cause");
      expect(String(error)).toContain("DiffSchema");
    }
  });

  it("uses the unknown SHA marker for abbreviated blob SHAs", () => {
    const raw = `diff --git a/src/short-sha.ts b/src/short-sha.ts
index e69de29..4b825dc 100644
--- a/src/short-sha.ts
+++ b/src/short-sha.ts
@@ -0,0 +1 @@
+export const ready = true;`;

    // Given the raw unified diff uses abbreviated SHAs.
    // When the maintainer parses the diff.
    const diff = parseUnifiedDiff(raw);

    // Then the file remains visible with schema-valid display data.
    expect(DiffSchema.parse(diff)).toEqual(diff);
    expect(diff.files[0]).toMatchObject({ path: "src/short-sha.ts", sha: UnknownFileSha });
  });
});

describe("parseUnifiedDiff public API", () => {
  it("accepts a raw unified diff string and returns a Diff", () => {
    const raw = `diff --git a/src/index.ts b/src/index.ts
index 1111111111111111111111111111111111111111..2222222222222222222222222222222222222222 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1 +1,2 @@
 export const version = "0.1.0";
+export const channel = "community";`;

    // Given a TypeScript maintainer imports `parseUnifiedDiff`.
    // When the maintainer calls `parseUnifiedDiff(raw)`.
    const diff = parseUnifiedDiff(raw);

    // Then the returned value is a `Diff`.
    expect(DiffSchema.parse(diff)).toEqual(diff);
    expect(diff.files[0]?.path).toBe("src/index.ts");
    expect(diff.files[0]?.hunks).toHaveLength(1);
  });

  it("reports malformed diff text as a typed parser failure", () => {
    // Given the raw unified diff is not a unified diff.
    const raw = "this is not a unified diff";

    // When the maintainer calls `parseUnifiedDiff(raw)`.
    const result = () => parseUnifiedDiff(raw);

    // Then parsing fails with an understandable `DiffParseError`.
    expect(result).toThrow(DiffParseError);
    expect(result).toThrow("Unable to parse unified diff");
  });
});
