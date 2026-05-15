// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { describe, expect, it } from "vitest";

import { DiffParseError, mapParsedDiffFiles } from "./parser.js";

describe("parse-diff mapping", () => {
  it("normalizes modified file fields for review display", () => {
    // Given parse-diff produced a modified file with one chunk.
    const diff = mapParsedDiffFiles(
      [
        {
          from: "a/src/app.ts",
          to: "b/src/app.ts",
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
    const result = () =>
      mapParsedDiffFiles([{ chunks: [], deletions: 0, additions: 0 }], "diff --git");

    // When the maintainer maps the parse-diff output.
    // Then parsing fails and identifies path normalization.
    expect(result).toThrow(DiffParseError);
    expect(result).toThrow("file path could not be normalized");
  });

  it.each([
    ["a/src/app.ts", "b/src/app.ts", "src/app.ts", undefined],
    ["/dev/null", "b/src/new.ts", "src/new.ts", undefined],
    ["a/src/old.ts", "/dev/null", "src/old.ts", undefined],
    ["a/src/old-name.ts", "b/src/new-name.ts", "src/new-name.ts", "src/old-name.ts"],
  ])("strips Git prefixes from %s to %s", (from, to, path, previousPath) => {
    // Given parse-diff produced a file from the table paths.
    const diff = mapParsedDiffFiles(
      [{ from, to, additions: 0, deletions: 0, chunks: [] }],
      `diff --git ${from} ${to}`,
    );

    // When the maintainer maps the parse-diff output.
    // Then current and previous display paths are normalized.
    expect(diff.files[0]?.path).toBe(path);
    expect(diff.files[0]?.previous_path).toBe(previousPath);
  });
});
