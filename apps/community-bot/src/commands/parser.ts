// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

export type ParsedCommand = { readonly kind: "re-review" } | { readonly kind: "no-mention" };

const ReReviewMentionPattern = /^@sovri-bot\s+re-review$/imu;

export function parseCommand(body: string): ParsedCommand {
  if (ReReviewMentionPattern.test(body)) {
    return { kind: "re-review" };
  }

  return { kind: "no-mention" };
}
