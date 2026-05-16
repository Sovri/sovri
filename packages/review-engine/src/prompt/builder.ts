// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

export interface PullRequestPromptContext {
  readonly number: number;
  readonly repoFullName: string;
  readonly title: string;
  readonly description: string | null;
}

export function buildUserPrompt(diff: string, prContext: PullRequestPromptContext): string {
  return [
    "Review this pull request.",
    `Repository: ${prContext.repoFullName}`,
    `Pull request: #${prContext.number}`,
    `Title: ${prContext.title}`,
    `Description: ${prContext.description ?? ""}`,
    "",
    "Diff:",
    diff,
  ].join("\n");
}
