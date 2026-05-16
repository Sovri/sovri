// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { describe, expect, it } from "vitest";

import { DiffParseError, mapParsedDiffFiles, parseUnifiedDiff } from "./parser.js";

const UnknownFileSha = "0000000000000000000000000000000000000000";

describe("binary, rename, and deletion entries", () => {
  it("keeps a modified binary file visible with skipped content", () => {
    const raw = `diff --git a/assets/logo.png b/assets/logo.png
index e69de29..4b825dc 100644
Binary files a/assets/logo.png and b/assets/logo.png differ`;

    // Given the raw unified diff is a binary file change.
    // When the maintainer parses the diff.
    const diff = parseUnifiedDiff(raw);

    // Then the file remains visible and content hunks are skipped.
    expect(diff.files).toHaveLength(1);
    expect(diff.files[0]).toMatchObject({
      path: "assets/logo.png",
      status: "modified",
      patch: null,
      hunks: [],
      additions: 0,
      deletions: 0,
      sha: UnknownFileSha,
    });
  });

  it.each([
    ["assets/new.png", "added", "added"],
    ["assets/logo.png", "modified", "modified"],
    ["assets/old.png", "deleted", "removed"],
  ])("keeps binary %s entries as %s", (path, shape, status) => {
    // Given the raw unified diff contains the binary file shape.
    const raw = binaryDiff(path, shape);

    // When the maintainer parses the diff.
    const diff = parseUnifiedDiff(raw);

    // Then status and skipped content fields are preserved.
    expect(diff.files[0]).toMatchObject({ path, status, patch: null, hunks: [] });
  });

  it("records previous and current paths for a rename-only diff", () => {
    const raw = `diff --git a/src/old-name.ts b/src/new-name.ts
similarity index 100%
rename from src/old-name.ts
rename to src/new-name.ts`;

    // Given the raw unified diff is a rename-only diff.
    // When the maintainer parses the diff.
    const diff = parseUnifiedDiff(raw);

    // Then the rename metadata is available for review display.
    expect(diff.files[0]).toMatchObject({
      path: "src/new-name.ts",
      previous_path: "src/old-name.ts",
      status: "renamed",
      additions: 0,
      deletions: 0,
      hunks: [],
    });
  });

  it("rejects a renamed file without the original path", () => {
    // Given parse-diff produced a renamed file with no previous path.
    const result = () =>
      mapParsedDiffFiles(
        [{ to: "src/new-name.ts", renamed: true, additions: 0, deletions: 0, chunks: [] }],
        "diff --git a/src/old-name.ts b/src/new-name.ts",
      );

    // When the maintainer maps the parse-diff output.
    // Then the DiffSchema renamed-file invariant fails.
    expect(result).toThrow(DiffParseError);
    expect(result).toThrow("DiffSchema");
  });

  it("maps a deleted textual file to removed status without previous_path", () => {
    const raw = `diff --git a/src/obsolete.ts b/src/obsolete.ts
deleted file mode 100644
index 1111111111111111111111111111111111111111..0000000000000000000000000000000000000000
--- a/src/obsolete.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-export const obsolete = true;
-export const removeMe = true;`;

    // Given the raw unified diff deletes a textual file.
    // When the maintainer parses the diff.
    const diff = parseUnifiedDiff(raw);

    // Then the deletion is a removed file without rename metadata.
    expect(diff.files[0]).toMatchObject({
      path: "src/obsolete.ts",
      status: "removed",
      additions: 0,
      deletions: 2,
    });
    expect(diff.files[0]?.previous_path).toBeUndefined();
    expect(diff.files[0]?.hunks).toHaveLength(1);
  });

  it("keeps rename metadata and content hunks for a renamed file with edits", () => {
    const raw = `diff --git a/src/old-name.ts b/src/new-name.ts
similarity index 80%
rename from src/old-name.ts
rename to src/new-name.ts
index 1111111111111111111111111111111111111111..2222222222222222222222222222222222222222 100644
--- a/src/old-name.ts
+++ b/src/new-name.ts
@@ -1 +1,2 @@
 export const name = "old";
+export const reviewed = true;`;

    // Given the raw unified diff renames a file and edits its content.
    // When the maintainer parses the diff.
    const diff = parseUnifiedDiff(raw);

    // Then both rename metadata and content hunks are preserved.
    expect(diff.files[0]).toMatchObject({
      path: "src/new-name.ts",
      previous_path: "src/old-name.ts",
      status: "renamed",
      additions: 1,
      deletions: 0,
    });
    expect(diff.files[0]?.hunks).toHaveLength(1);
  });
});

function binaryDiff(path: string, shape: string): string {
  if (shape === "added") {
    return `diff --git a/${path} b/${path}
new file mode 100644
index 0000000..4b825dc
Binary files /dev/null and b/${path} differ`;
  }
  if (shape === "deleted") {
    return `diff --git a/${path} b/${path}
deleted file mode 100644
index e69de29..0000000
Binary files a/${path} and /dev/null differ`;
  }
  return `diff --git a/${path} b/${path}
index e69de29..4b825dc 100644
Binary files a/${path} and b/${path} differ`;
}
