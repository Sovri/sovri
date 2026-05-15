// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { z } from "zod";

export const ReviewPromptInputSchema = z.strictObject({
  unifiedDiff: z.string(),
  instructions: z.array(z.string().min(1)).default([]),
});

export type ReviewPromptInput = z.input<typeof ReviewPromptInputSchema>;

export interface ReviewPrompt {
  readonly systemPrompt: string;
  readonly userPrompt: string;
}

export function buildReviewPrompt(input: ReviewPromptInput): ReviewPrompt {
  const promptInput = ReviewPromptInputSchema.parse(input);
  const instructions = promptInput.instructions.map((item) => `- ${item}`).join("\n");
  const instructionBlock =
    instructions.length > 0 ? `\n\nRepository instructions:\n${instructions}` : "";

  return {
    systemPrompt:
      "You are Sovri's review engine. Review only the supplied unified diff and return structured JSON.",
    userPrompt: `Review this unified diff.${instructionBlock}\n\n\`\`\`diff\n${promptInput.unifiedDiff}\n\`\`\``,
  };
}
