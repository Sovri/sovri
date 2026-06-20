// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri contributors

// R-04 (issue #2627): the system prompt template stays within the 1024-byte cap
// (SYSTEM_PROMPT_MAX_BYTES, issue #2450). This is the regression guard that keeps the directive
// growth from R-01..R-03 (mappable CWE, positive instruction, framework names) inside the cap;
// detail that would overflow must move to the few-shot preamble in the uncapped user prompt.

import { describe, expect, it } from "vitest";

import {
  buildSystemPrompt,
  PromptTemplateSizeError,
  ReviewPromptModeSchema,
  SYSTEM_PROMPT_MAX_BYTES,
  validateSystemTemplateSize,
} from "./builder.js";

function utf8ByteLength(content: string): number {
  return new TextEncoder().encode(content).byteLength;
}

describe("R-04: the system prompt template stays within the 1024-byte cap", () => {
  // Background: Sovri's review engine assembles the LLM review prompt.

  describe("Scenario Outline: every review mode builds a system prompt within the cap", () => {
    it.each(ReviewPromptModeSchema.options)(
      'the "%s" mode system prompt stays within the cap',
      (mode) => {
        // When the review engine builds the system prompt for the "<mode>" mode
        const build = () => buildSystemPrompt({ mode });

        // And building it raises no PromptTemplateSizeError
        expect(build).not.toThrow();
        // Then the system prompt is at most 1024 UTF-8 bytes
        expect(utf8ByteLength(build())).toBeLessThanOrEqual(SYSTEM_PROMPT_MAX_BYTES);
      },
    );
  });

  it("a template of exactly 1024 bytes is accepted", () => {
    // Given a system template measuring exactly 1024 UTF-8 bytes
    const template = "a".repeat(1024);

    // When the review engine validates the template size
    // Then the template is accepted and returned unchanged
    expect(validateSystemTemplateSize(template)).toBe(template);
  });

  it("a template of 1025 bytes is rejected", () => {
    // Given a system template measuring 1025 UTF-8 bytes
    const template = "a".repeat(1025);

    // When the review engine validates the template size
    let caught: unknown;
    try {
      validateSystemTemplateSize(template);
    } catch (error) {
      caught = error;
    }

    // Then it raises a PromptTemplateSizeError reporting 1025 bytes against the 1024-byte cap
    expect(caught).toBeInstanceOf(PromptTemplateSizeError);
    const error = caught as PromptTemplateSizeError;
    expect(error.templateBytes).toBe(1025);
    expect(error.maxBytes).toBe(SYSTEM_PROMPT_MAX_BYTES);
  });
});
