// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { FindingSchema, z, type Diff, type Finding } from "@sovri/core";

export const InlineCommentDraftSchema = z.object({
  path: z.string().min(1),
  body: z.string().min(1),
  line: z.number().int().positive(),
  side: z.literal("RIGHT"),
});

export type InlineCommentDraft = z.infer<typeof InlineCommentDraftSchema>;

export function buildInlineComments(
  findings: readonly Finding[],
  _diff: Diff,
): InlineCommentDraft[] {
  const validFindings = z.array(FindingSchema).parse(findings);

  return validFindings.map((finding) =>
    InlineCommentDraftSchema.parse({
      path: finding.file,
      body: formatInlineBody(finding),
      line: finding.line_start,
      side: "RIGHT",
    }),
  );
}

function formatInlineBody(finding: Finding): string {
  return [`**${finding.title}**`, "", finding.body].join("\n");
}
