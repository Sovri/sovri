// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import type { Diff, Finding } from "@sovri/core";
import { describe, expect, it } from "vitest";

import { buildInlineComments } from "./inline.js";

const sha = "1".repeat(40);

describe("buildInlineComments", () => {
  it("converts valid findings into inline comment drafts", () => {
    // Given a parsed diff contains file "src/session.ts" with RIGHT-side lines 18 and 19
    const diff: Diff = {
      unified_diff: [
        "diff --git a/src/session.ts b/src/session.ts",
        `index ${"0".repeat(40)}..${sha} 100644`,
        "--- a/src/session.ts",
        "+++ b/src/session.ts",
        "@@ -18,0 +18,2 @@",
        "+const userId = session.user.id;",
        "+throw new Error('session failed');",
      ].join("\n"),
      files: [
        {
          path: "src/session.ts",
          status: "modified",
          additions: 2,
          deletions: 0,
          sha,
          patch: [
            "diff --git a/src/session.ts b/src/session.ts",
            `index ${"0".repeat(40)}..${sha} 100644`,
            "--- a/src/session.ts",
            "+++ b/src/session.ts",
            "@@ -18,0 +18,2 @@",
            "+const userId = session.user.id;",
            "+throw new Error('session failed');",
          ].join("\n"),
          hunks: [
            {
              old_start: 18,
              old_lines: 0,
              new_start: 18,
              new_lines: 2,
              header: "@@ -18,0 +18,2 @@",
              lines: ["+const userId = session.user.id;", "+throw new Error('session failed');"],
            },
          ],
        },
      ],
    };

    // And the findings list contains:
    //   | file           | line_start | line_end | title              | body                                  |
    //   | src/session.ts | 18         | 18       | Missing null guard | `session.user` can be undefined.      |
    //   | src/session.ts | 19         | 19       | Weak error message | The thrown error hides useful context. |
    const findings: Finding[] = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        severity: "major",
        category: "bug",
        file: "src/session.ts",
        line_start: 18,
        line_end: 18,
        title: "Missing null guard",
        body: "`session.user` can be undefined.",
        source: "llm",
        confidence: 0.87,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        severity: "minor",
        category: "maintainability",
        file: "src/session.ts",
        line_start: 19,
        line_end: 19,
        title: "Weak error message",
        body: "The thrown error hides useful context.",
        source: "llm",
        confidence: 0.72,
      },
    ];

    // When the maintainer calls `buildInlineComments(findings, diff)`
    const comments = buildInlineComments(findings, diff);

    // Then exactly 2 inline comment drafts are returned
    expect(comments).toHaveLength(2);
    // And the first draft path is "src/session.ts"
    expect(comments[0]?.path).toBe("src/session.ts");
    // And the first draft line is 18
    expect(comments[0]?.line).toBe(18);
    // And the second draft path is "src/session.ts"
    expect(comments[1]?.path).toBe("src/session.ts");
    // And the second draft line is 19
    expect(comments[1]?.line).toBe(19);
  });
});
