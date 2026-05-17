// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { FindingSchema, z, type Diff, type Finding } from "@sovri/core";

export const InlineCommentDraftSchema = z
  .object({
    path: z.string().min(1),
    body: z.string().min(1),
    start_line: z.number().int().positive().optional(),
    start_side: z.literal("RIGHT").optional(),
    line: z.number().int().positive(),
    side: z.literal("RIGHT"),
  })
  .strict();

export type InlineCommentDraft = z.infer<typeof InlineCommentDraftSchema>;

export function buildInlineComments(
  findings: readonly Finding[],
  _diff: Diff,
): InlineCommentDraft[] {
  const validFindings = z.array(FindingSchema).parse(findings);

  return validFindings.map((finding) => buildInlineCommentDraft(finding));
}

function buildInlineCommentDraft(finding: Finding): InlineCommentDraft {
  const base = {
    path: finding.file,
    body: formatInlineBody(finding),
  };

  if (finding.line_start === finding.line_end) {
    return InlineCommentDraftSchema.parse({
      ...base,
      line: finding.line_start,
      side: "RIGHT",
    });
  }

  return InlineCommentDraftSchema.parse({
    ...base,
    start_line: finding.line_start,
    start_side: "RIGHT",
    line: finding.line_end,
    side: "RIGHT",
  });
}

function formatInlineBody(finding: Finding): string {
  return [`**${finding.title}**`, "", finding.body].join("\n");
}
