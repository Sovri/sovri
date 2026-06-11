// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri contributors

import { describe, expect, it } from "vitest";

import { DiffParseError, mapParsedDiffFiles } from "./parser.js";

describe("parse-diff mapping", () => {
  it("normalizes modified file fields for review display", () => {
    // Given parse-diff produced a modified file with one chunk (prefix already stripped by parse-diff).
    const diff = mapParsedDiffFiles(
      [
        {
          from: "src/app.ts",
          to: "src/app.ts",
          additions: 2,
          deletions: 1,
          chunks: [
            {
              content: "@@ -10,3 +10,4 @@",
              oldStart: 10,
              oldLines: 3,
              newStart: 10,
              newLines: 4,
              changes: [
                { type: "normal", content: ' const status = "pending";' },
                { type: "del", content: "-const enabled = false;" },
                { type: "add", content: "+const enabled = true;" },
                { type: "add", content: "+const reviewed = true;" },
              ],
            },
          ],
          index: [
            "1111111111111111111111111111111111111111..2222222222222222222222222222222222222222",
          ],
        },
      ],
      "diff --git a/src/app.ts b/src/app.ts",
    );

    // When the maintainer maps the parse-diff output.
    const file = diff.files[0];
    const hunk = file?.hunks[0];

    // Then normalized fields match the Sovri core contract.
    expect(file).toMatchObject({
      path: "src/app.ts",
      status: "modified",
      additions: 2,
      deletions: 1,
    });
    expect(file?.previous_path).toBeUndefined();
    expect(hunk).toMatchObject({
      old_start: 10,
      old_lines: 3,
      new_start: 10,
      new_lines: 4,
      lines: [
        ' const status = "pending";',
        "-const enabled = false;",
        "+const enabled = true;",
        "+const reviewed = true;",
      ],
    });
  });

  it("rejects an unsupported file shape without a normalizable path", () => {
    // Given parse-diff produced a file with no `from` path and no `to` path.
    const unshaped = [{ chunks: [], deletions: 0, additions: 0 }];

    // When the maintainer maps the parse-diff output.
    // Then parsing fails and identifies path normalization.
    expect(() => mapParsedDiffFiles(unshaped, "diff --git")).toThrow(DiffParseError);
    expect(() => mapParsedDiffFiles(unshaped, "diff --git")).toThrow(
      "file path could not be normalized",
    );
  });

  it.each([
    ["src/app.ts", "src/app.ts", "src/app.ts", undefined],
    ["/dev/null", "src/new.ts", "src/new.ts", undefined],
    ["src/old.ts", "/dev/null", "src/old.ts", undefined],
    ["src/old-name.ts", "src/new-name.ts", "src/new-name.ts", "src/old-name.ts"],
    ["a/config.ts", "a/config.ts", "a/config.ts", undefined],
  ])("normalizes %s and %s into review display paths", (from, to, path, previousPath) => {
    // Given parse-diff produced a file from the table paths (Git prefix already stripped upstream).
    const diff = mapParsedDiffFiles(
      [{ from, to, additions: 0, deletions: 0, chunks: [] }],
      `diff --git a/${path} b/${path}`,
    );

    // When the maintainer maps the parse-diff output.
    // Then current and previous display paths are preserved verbatim (no double-strip).
    expect(diff.files[0]?.path).toBe(path);
    expect(diff.files[0]?.previous_path).toBe(previousPath);
  });
});
