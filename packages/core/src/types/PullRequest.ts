// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { z } from "zod";

const Sha40HexPattern = /^[a-f0-9]{40}$/;
const RepositoryFullNamePattern =
  /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?\/[A-Za-z0-9._-]{1,100}$/;

// Normalised status enum. GitHub's `pulls.listFiles` also returns "copied",
// "changed", and "unchanged"; callers must map them to one of the four values
// below (typically copied → renamed, changed/unchanged → modified) before
// parsing. Parsing a raw Octokit payload is intentionally a hard failure.
export const FileChangeStatusSchema = z.enum(["added", "modified", "removed", "renamed"]);
export type FileChangeStatus = z.infer<typeof FileChangeStatusSchema>;

const HunkSchema = z.object({
  old_start: z.number().int().nonnegative(),
  old_lines: z.number().int().nonnegative(),
  new_start: z.number().int().nonnegative(),
  new_lines: z.number().int().nonnegative(),
  header: z.string().min(1),
  lines: z.array(z.string()),
});

export const FileChangeSchema = z
  .object({
    path: z.string().min(1),
    previous_path: z.string().min(1).optional(),
    status: FileChangeStatusSchema,
    additions: z.number().int().nonnegative(),
    deletions: z.number().int().nonnegative(),
    sha: z.string().regex(Sha40HexPattern),
    patch: z.string().nullable(),
    hunks: z.array(HunkSchema),
  })
  .superRefine((file, context) => {
    if (file.status === "renamed") {
      if (file.previous_path === undefined) {
        context.addIssue({
          code: "custom",
          path: ["previous_path"],
          message: "previous_path is required when status is renamed",
        });
      } else if (file.previous_path === file.path) {
        context.addIssue({
          code: "custom",
          path: ["previous_path"],
          message: "previous_path must differ from path on renamed files",
        });
      }
    } else if (file.previous_path !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["previous_path"],
        message: "previous_path is only allowed when status is renamed",
      });
    }
  });
export type FileChange = z.infer<typeof FileChangeSchema>;

export const DiffSchema = z.object({
  unified_diff: z.string(),
  files: z.array(FileChangeSchema),
});
export type Diff = z.infer<typeof DiffSchema>;

export const PullRequestSchema = z.object({
  number: z.number().int().positive(),
  repo_full_name: z.string().regex(RepositoryFullNamePattern),
  head_sha: z.string().regex(Sha40HexPattern),
  head_ref: z.string().min(1),
  base_sha: z.string().regex(Sha40HexPattern),
  base_ref: z.string().min(1),
  author: z.string().min(1),
  draft: z.boolean(),
  title: z.string().min(1),
  body: z.string().nullable(),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  changed_files: z.number().int().nonnegative(),
});
export type PullRequest = z.infer<typeof PullRequestSchema>;
