// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import type { Diff, Finding } from "@sovri/core";

export type InlineCommentDraft = {
  readonly path: string;
  readonly body: string;
  readonly line: number;
  readonly side: "RIGHT";
};

export function buildInlineComments(
  findings: readonly Finding[],
  _diff: Diff,
): InlineCommentDraft[] {
  return findings.map((finding) => ({
    path: finding.file,
    body: formatInlineBody(finding),
    line: finding.line_start,
    side: "RIGHT",
  }));
}

function formatInlineBody(finding: Finding): string {
  return [`**${finding.title}**`, "", finding.body].join("\n");
}
