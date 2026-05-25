// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

export type ParsedCommand =
  | { readonly kind: "re-review" }
  | { readonly kind: "dismiss"; readonly findingId: string }
  | { readonly kind: "no-mention" };

const DismissMentionPattern = /^@sovri-bot\s+dismiss\s+([A-Za-z0-9-]+)$/iu;
const ReReviewMentionPattern = /^@sovri-bot\s+re-review$/iu;

export function parseCommand(body: string): ParsedCommand {
  for (const line of body.split(/\r?\n/u)) {
    const dismissMatch = DismissMentionPattern.exec(line);
    const findingId = dismissMatch?.[1];
    if (findingId !== undefined) {
      return { kind: "dismiss", findingId };
    }

    if (ReReviewMentionPattern.test(line)) {
      return { kind: "re-review" };
    }
  }

  return { kind: "no-mention" };
}
