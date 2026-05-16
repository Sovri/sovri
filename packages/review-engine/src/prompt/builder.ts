// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { z } from "zod";

export const PullRequestPromptContextSchema = z.strictObject({
  number: z.number().int().positive(),
  repoFullName: z.string().min(1),
  title: z.string(),
  description: z.string().nullable(),
});

export type PullRequestPromptContext = z.infer<typeof PullRequestPromptContextSchema>;

export function buildUserPrompt(diff: string, prContext: PullRequestPromptContext): string {
  const context = PullRequestPromptContextSchema.parse(prContext);

  return [
    "Review this pull request.",
    `Repository: ${context.repoFullName}`,
    `Pull request: #${context.number}`,
    `Title: ${context.title}`,
    `Description: ${context.description ?? ""}`,
    "",
    "Diff:",
    diff,
  ].join("\n");
}
