// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { describe, expect, it } from "vitest";

import {
  DiffSchema,
  FileChangeSchema,
  FileChangeStatusSchema,
  PullRequestSchema,
  type Diff,
  type FileChange,
  type FileChangeStatus,
  type PullRequest,
} from "./PullRequest.js";

const sha40 = (char: string): string => char.repeat(40);

const baseFileChange: FileChange = {
  path: "src/index.ts",
  status: "modified",
  additions: 5,
  deletions: 2,
  sha: sha40("a"),
  patch: "@@ -1,3 +1,6 @@\n line 1\n+added\n line 2\n line 3",
  hunks: [
    {
      old_start: 1,
      old_lines: 3,
      new_start: 1,
      new_lines: 6,
      header: "@@ -1,3 +1,6 @@",
      lines: [" line 1", "+added", " line 2", " line 3"],
    },
  ],
};

const baseDiff: Diff = {
  unified_diff: "diff --git a/src/index.ts b/src/index.ts\n@@ -1,3 +1,6 @@\n line 1\n+added\n",
  files: [baseFileChange],
};

const basePullRequest: PullRequest = {
  number: 42,
  repo_full_name: "sovri/example",
  head_sha: sha40("a"),
  head_ref: "feature/new-thing",
  base_sha: sha40("b"),
  base_ref: "main",
  author: "octocat",
  draft: false,
  title: "Add new thing",
  body: "This PR adds the new thing.",
  additions: 10,
  deletions: 4,
  changed_files: 1,
};

describe("FileChangeStatusSchema", () => {
  const validStatuses = [
    "added",
    "modified",
    "removed",
    "renamed",
  ] satisfies readonly FileChangeStatus[];

  it.each(validStatuses)("accepts %s", (value) => {
    expect(FileChangeStatusSchema.parse(value)).toBe(value);
  });

  it.each(["copied", "changed", "unchanged", "draft"])(
    "rejects status not in the four-value enum (%s)",
    (value) => {
      expect(FileChangeStatusSchema.safeParse(value).success).toBe(false);
    },
  );

  it("rejects an empty string", () => {
    expect(FileChangeStatusSchema.safeParse("").success).toBe(false);
  });

  it("rejects a non-string value", () => {
    expect(FileChangeStatusSchema.safeParse(0).success).toBe(false);
    expect(FileChangeStatusSchema.safeParse(null).success).toBe(false);
    expect(FileChangeStatusSchema.safeParse(undefined).success).toBe(false);
  });
});

describe("FileChangeSchema — happy paths", () => {
  it("accepts a modified file with a textual patch", () => {
    expect(FileChangeSchema.parse(baseFileChange)).toEqual(baseFileChange);
  });

  it("accepts an added file (status: added)", () => {
    const parsed = FileChangeSchema.parse({ ...baseFileChange, status: "added", deletions: 0 });
    expect(parsed.status).toBe("added");
    expect(parsed.deletions).toBe(0);
  });

  it("accepts a removed file (status: removed)", () => {
    const parsed = FileChangeSchema.parse({ ...baseFileChange, status: "removed", additions: 0 });
    expect(parsed.status).toBe("removed");
    expect(parsed.additions).toBe(0);
  });

  it("accepts a renamed file with previous_path", () => {
    const parsed = FileChangeSchema.parse({
      ...baseFileChange,
      status: "renamed",
      previous_path: "src/old.ts",
      path: "src/new.ts",
    });
    expect(parsed.previous_path).toBe("src/old.ts");
    expect(parsed.path).toBe("src/new.ts");
  });

  it("accepts a null patch (binary or oversized file)", () => {
    const parsed = FileChangeSchema.parse({ ...baseFileChange, patch: null, hunks: [] });
    expect(parsed.patch).toBeNull();
    expect(parsed.hunks).toEqual([]);
  });

  it("accepts an empty hunks array", () => {
    const parsed = FileChangeSchema.parse({ ...baseFileChange, hunks: [] });
    expect(parsed.hunks).toEqual([]);
  });

  it("accepts multiple hunks", () => {
    const parsed = FileChangeSchema.parse({
      ...baseFileChange,
      hunks: [
        baseFileChange.hunks[0]!,
        {
          old_start: 20,
          old_lines: 2,
          new_start: 23,
          new_lines: 3,
          header: "@@ -20,2 +23,3 @@",
          lines: [" context", "+inserted", " trailing"],
        },
      ],
    });
    expect(parsed.hunks).toHaveLength(2);
  });

  it("accepts zero additions and zero deletions", () => {
    const parsed = FileChangeSchema.parse({
      ...baseFileChange,
      additions: 0,
      deletions: 0,
    });
    expect(parsed.additions).toBe(0);
    expect(parsed.deletions).toBe(0);
  });

  it("accepts hunk boundaries at zero (new file with zero old lines)", () => {
    const parsed = FileChangeSchema.parse({
      ...baseFileChange,
      status: "added",
      deletions: 0,
      hunks: [
        {
          old_start: 0,
          old_lines: 0,
          new_start: 1,
          new_lines: 3,
          header: "@@ -0,0 +1,3 @@",
          lines: ["+a", "+b", "+c"],
        },
      ],
    });
    expect(parsed.hunks[0]!.old_start).toBe(0);
    expect(parsed.hunks[0]!.old_lines).toBe(0);
  });
});

describe("FileChangeSchema — path", () => {
  it("rejects an empty path", () => {
    expect(FileChangeSchema.safeParse({ ...baseFileChange, path: "" }).success).toBe(false);
  });

  it("rejects a non-string path", () => {
    expect(FileChangeSchema.safeParse({ ...baseFileChange, path: 42 }).success).toBe(false);
  });
});

describe("FileChangeSchema — sha", () => {
  it("rejects a sha shorter than 40 characters", () => {
    expect(
      FileChangeSchema.safeParse({ ...baseFileChange, sha: sha40("a").slice(0, 39) }).success,
    ).toBe(false);
  });

  it("rejects a sha longer than 40 characters", () => {
    expect(FileChangeSchema.safeParse({ ...baseFileChange, sha: `${sha40("a")}a` }).success).toBe(
      false,
    );
  });

  it("rejects a 40-character non-hex sha", () => {
    expect(FileChangeSchema.safeParse({ ...baseFileChange, sha: sha40("g") }).success).toBe(false);
  });

  it("rejects an uppercase hex sha", () => {
    expect(FileChangeSchema.safeParse({ ...baseFileChange, sha: sha40("A") }).success).toBe(false);
  });
});

describe("FileChangeSchema — additions/deletions (nonneg int)", () => {
  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects additions = %p", (value) => {
    expect(FileChangeSchema.safeParse({ ...baseFileChange, additions: value }).success).toBe(false);
  });

  it.each([-1, 2.7, Number.NaN, Number.POSITIVE_INFINITY])("rejects deletions = %p", (value) => {
    expect(FileChangeSchema.safeParse({ ...baseFileChange, deletions: value }).success).toBe(false);
  });

  it("rejects a non-numeric additions", () => {
    expect(FileChangeSchema.safeParse({ ...baseFileChange, additions: "5" }).success).toBe(false);
  });
});

describe("FileChangeSchema — patch", () => {
  it("rejects a numeric patch", () => {
    expect(FileChangeSchema.safeParse({ ...baseFileChange, patch: 42 }).success).toBe(false);
  });

  it("rejects an undefined patch (must be string or null)", () => {
    const broken = { ...baseFileChange, patch: undefined };
    expect(FileChangeSchema.safeParse(broken).success).toBe(false);
  });

  it("accepts an empty string patch", () => {
    const parsed = FileChangeSchema.parse({ ...baseFileChange, patch: "" });
    expect(parsed.patch).toBe("");
  });
});

describe("FileChangeSchema — hunks", () => {
  it("rejects a non-array hunks", () => {
    expect(
      FileChangeSchema.safeParse({ ...baseFileChange, hunks: "@@ -1,1 +1,1 @@" }).success,
    ).toBe(false);
  });

  it("rejects a hunk with a negative old_start", () => {
    expect(
      FileChangeSchema.safeParse({
        ...baseFileChange,
        hunks: [{ ...baseFileChange.hunks[0]!, old_start: -1 }],
      }).success,
    ).toBe(false);
  });

  it("rejects a hunk with a fractional new_lines", () => {
    expect(
      FileChangeSchema.safeParse({
        ...baseFileChange,
        hunks: [{ ...baseFileChange.hunks[0]!, new_lines: 1.5 }],
      }).success,
    ).toBe(false);
  });

  it("rejects a hunk with an empty header", () => {
    expect(
      FileChangeSchema.safeParse({
        ...baseFileChange,
        hunks: [{ ...baseFileChange.hunks[0]!, header: "" }],
      }).success,
    ).toBe(false);
  });

  it("rejects a hunk with a non-string line", () => {
    expect(
      FileChangeSchema.safeParse({
        ...baseFileChange,
        hunks: [{ ...baseFileChange.hunks[0]!, lines: [" ok", 42] }],
      }).success,
    ).toBe(false);
  });

  it("rejects a hunk missing new_start", () => {
    const { new_start: _omit, ...partial } = baseFileChange.hunks[0]!;
    expect(
      FileChangeSchema.safeParse({
        ...baseFileChange,
        hunks: [partial],
      }).success,
    ).toBe(false);
  });
});

describe("FileChangeSchema — previous_path / status invariant", () => {
  it("rejects a renamed file without previous_path", () => {
    const result = FileChangeSchema.safeParse({
      ...baseFileChange,
      status: "renamed",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["previous_path"]);
    }
  });

  it("rejects a renamed file where previous_path equals path", () => {
    const result = FileChangeSchema.safeParse({
      ...baseFileChange,
      status: "renamed",
      path: "src/same.ts",
      previous_path: "src/same.ts",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["previous_path"]);
    }
  });

  it("rejects a non-renamed file that carries a previous_path", () => {
    const result = FileChangeSchema.safeParse({
      ...baseFileChange,
      status: "modified",
      previous_path: "src/leftover.ts",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["previous_path"]);
    }
  });

  it("rejects an empty previous_path on a renamed file", () => {
    const result = FileChangeSchema.safeParse({
      ...baseFileChange,
      status: "renamed",
      previous_path: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["previous_path"]);
    }
  });
});

describe("FileChangeSchema — required field omissions", () => {
  const requiredKeys = [
    "path",
    "status",
    "additions",
    "deletions",
    "sha",
    "patch",
    "hunks",
  ] as const;

  it.each(requiredKeys)("rejects a file_change missing %s", (key) => {
    const broken = { ...baseFileChange } as Record<string, unknown>;
    delete broken[key];
    expect(FileChangeSchema.safeParse(broken).success).toBe(false);
  });
});

describe("DiffSchema — happy paths", () => {
  it("accepts a diff with one file", () => {
    expect(DiffSchema.parse(baseDiff)).toEqual(baseDiff);
  });

  it("accepts a diff with an empty files array", () => {
    const parsed = DiffSchema.parse({ unified_diff: "", files: [] });
    expect(parsed.files).toEqual([]);
  });

  it("accepts a diff with multiple files", () => {
    const parsed = DiffSchema.parse({
      unified_diff: baseDiff.unified_diff,
      files: [baseFileChange, { ...baseFileChange, path: "src/other.ts", sha: sha40("c") }],
    });
    expect(parsed.files).toHaveLength(2);
  });
});

describe("DiffSchema — rejections", () => {
  it("rejects a non-string unified_diff", () => {
    expect(DiffSchema.safeParse({ ...baseDiff, unified_diff: 42 }).success).toBe(false);
  });

  it("rejects a non-array files", () => {
    expect(DiffSchema.safeParse({ ...baseDiff, files: "not-an-array" }).success).toBe(false);
  });

  it("rejects a diff containing an invalid file_change", () => {
    expect(
      DiffSchema.safeParse({ ...baseDiff, files: [{ ...baseFileChange, sha: "invalid" }] }).success,
    ).toBe(false);
  });
});

describe("DiffSchema — required field omissions", () => {
  const requiredKeys = ["unified_diff", "files"] as const;

  it.each(requiredKeys)("rejects a diff missing %s", (key) => {
    const broken = { ...baseDiff } as Record<string, unknown>;
    delete broken[key];
    expect(DiffSchema.safeParse(broken).success).toBe(false);
  });
});

describe("PullRequestSchema — happy paths", () => {
  it("accepts a valid pull request", () => {
    expect(PullRequestSchema.parse(basePullRequest)).toEqual(basePullRequest);
  });

  it("accepts a draft pull request", () => {
    const parsed = PullRequestSchema.parse({ ...basePullRequest, draft: true });
    expect(parsed.draft).toBe(true);
  });

  it("accepts a null body", () => {
    const parsed = PullRequestSchema.parse({ ...basePullRequest, body: null });
    expect(parsed.body).toBeNull();
  });

  it("accepts zero counts on additions/deletions/changed_files", () => {
    const parsed = PullRequestSchema.parse({
      ...basePullRequest,
      additions: 0,
      deletions: 0,
      changed_files: 0,
    });
    expect(parsed.additions).toBe(0);
    expect(parsed.deletions).toBe(0);
    expect(parsed.changed_files).toBe(0);
  });

  it("accepts head_sha === base_sha (no-op PR)", () => {
    const parsed = PullRequestSchema.parse({
      ...basePullRequest,
      head_sha: sha40("a"),
      base_sha: sha40("a"),
    });
    expect(parsed.head_sha).toBe(parsed.base_sha);
  });
});

describe("PullRequestSchema — number", () => {
  it.each([0, -1, 1.5, Number.NaN])("rejects number = %p", (value) => {
    expect(PullRequestSchema.safeParse({ ...basePullRequest, number: value }).success).toBe(false);
  });

  it("rejects a non-numeric number", () => {
    expect(PullRequestSchema.safeParse({ ...basePullRequest, number: "42" }).success).toBe(false);
  });
});

describe("PullRequestSchema — repo_full_name", () => {
  it("rejects a repo without owner segment", () => {
    expect(
      PullRequestSchema.safeParse({ ...basePullRequest, repo_full_name: "example" }).success,
    ).toBe(false);
  });

  it("rejects a repo with control characters", () => {
    expect(
      PullRequestSchema.safeParse({
        ...basePullRequest,
        repo_full_name: "sovri/example\nother",
      }).success,
    ).toBe(false);
  });

  it("rejects an empty repository segment", () => {
    expect(
      PullRequestSchema.safeParse({ ...basePullRequest, repo_full_name: "sovri/" }).success,
    ).toBe(false);
  });

  it("rejects a repository segment longer than 100 characters", () => {
    expect(
      PullRequestSchema.safeParse({
        ...basePullRequest,
        repo_full_name: `sovri/${"a".repeat(101)}`,
      }).success,
    ).toBe(false);
  });
});

describe("PullRequestSchema — sha fields", () => {
  it("rejects an invalid head_sha", () => {
    expect(PullRequestSchema.safeParse({ ...basePullRequest, head_sha: "short" }).success).toBe(
      false,
    );
  });

  it("rejects an invalid base_sha", () => {
    expect(PullRequestSchema.safeParse({ ...basePullRequest, base_sha: sha40("g") }).success).toBe(
      false,
    );
  });
});

describe("PullRequestSchema — ref fields", () => {
  it("rejects an empty head_ref", () => {
    expect(PullRequestSchema.safeParse({ ...basePullRequest, head_ref: "" }).success).toBe(false);
  });

  it("rejects an empty base_ref", () => {
    expect(PullRequestSchema.safeParse({ ...basePullRequest, base_ref: "" }).success).toBe(false);
  });
});

describe("PullRequestSchema — author and title", () => {
  it("rejects an empty author", () => {
    expect(PullRequestSchema.safeParse({ ...basePullRequest, author: "" }).success).toBe(false);
  });

  it("rejects an empty title", () => {
    expect(PullRequestSchema.safeParse({ ...basePullRequest, title: "" }).success).toBe(false);
  });
});

describe("PullRequestSchema — draft and counts", () => {
  it("rejects a non-boolean draft", () => {
    expect(PullRequestSchema.safeParse({ ...basePullRequest, draft: "false" }).success).toBe(false);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects additions = %p", (value) => {
    expect(PullRequestSchema.safeParse({ ...basePullRequest, additions: value }).success).toBe(
      false,
    );
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects deletions = %p", (value) => {
    expect(PullRequestSchema.safeParse({ ...basePullRequest, deletions: value }).success).toBe(
      false,
    );
  });

  it.each([-1, 2.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects changed_files = %p",
    (value) => {
      expect(
        PullRequestSchema.safeParse({ ...basePullRequest, changed_files: value }).success,
      ).toBe(false);
    },
  );
});

describe("PullRequestSchema — body", () => {
  it("rejects a numeric body", () => {
    expect(PullRequestSchema.safeParse({ ...basePullRequest, body: 42 }).success).toBe(false);
  });

  it("rejects an undefined body (must be string or null)", () => {
    const broken = { ...basePullRequest, body: undefined };
    expect(PullRequestSchema.safeParse(broken).success).toBe(false);
  });
});

describe("PullRequestSchema — required field omissions", () => {
  const requiredKeys = [
    "number",
    "repo_full_name",
    "head_sha",
    "head_ref",
    "base_sha",
    "base_ref",
    "author",
    "draft",
    "title",
    "body",
    "additions",
    "deletions",
    "changed_files",
  ] as const;

  it.each(requiredKeys)("rejects a pull_request missing %s", (key) => {
    const broken = { ...basePullRequest } as Record<string, unknown>;
    delete broken[key];
    expect(PullRequestSchema.safeParse(broken).success).toBe(false);
  });
});

describe("PullRequest / Diff / FileChange — type inference", () => {
  it("infers a PullRequest whose runtime parse round-trips", () => {
    const pr: PullRequest = { ...basePullRequest };
    expect(PullRequestSchema.parse(pr)).toEqual(pr);
  });

  it("infers a Diff whose runtime parse round-trips", () => {
    const diff: Diff = { ...baseDiff };
    expect(DiffSchema.parse(diff)).toEqual(diff);
  });

  it("infers a FileChange whose runtime parse round-trips", () => {
    const file: FileChange = { ...baseFileChange };
    expect(FileChangeSchema.parse(file)).toEqual(file);
  });

  it("infers FileChangeStatus as the schema's literal union", () => {
    const status: FileChangeStatus = "renamed";
    expect(FileChangeStatusSchema.parse(status)).toBe("renamed");
  });
});
