// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri contributors

import { AnthropicResponseError } from "@sovri/llm-providers";
import { describe, expect, it } from "vitest";

import { parseWithRetry } from "./retry.js";
import {
  buildResponse,
  createProvider,
  expectSyntheticFailure,
  invalidSeverityResponse,
  malformedJson,
  retryPrompts,
  schemaInvalidResponse,
} from "./retry.test-helpers.js";

describe("parseWithRetry failure findings", () => {
  it("returns synthetic failure without provider calls when retry budget is zero", async () => {
    const provider = createProvider([buildResponse()]);

    // Given the retry budget is 0
    const findings = await parseWithRetry(schemaInvalidResponse(), provider, retryPrompts, {
      retryBudget: 0,
    });

    // Then the provider is called 0 times
    expect(provider.calls).toHaveLength(0);

    // And the returned findings contain 1 synthetic failure finding
    expect(findings).toHaveLength(1);
    expectSyntheticFailure(findings[0]);
  });

  it("returns synthetic failure after exhausted malformed or schema-invalid retries", async () => {
    const cases: ReadonlyArray<{
      name: string;
      initialResponse: unknown;
      retryResponse: unknown;
    }> = [
      {
        name: "malformed JSON retry",
        initialResponse: malformedJson(),
        retryResponse: malformedJson(),
      },
      {
        name: "Zod-invalid retry response",
        initialResponse: schemaInvalidResponse(),
        retryResponse: invalidSeverityResponse(),
      },
    ];

    await Promise.all(
      cases.map(async (currentCase) => {
        const provider = createProvider([currentCase.retryResponse]);

        // When the maintainer calls `parseWithRetry`
        const findings = await parseWithRetry(currentCase.initialResponse, provider, retryPrompts);

        // Then the returned findings contain 1 synthetic failure finding
        expect(findings, currentCase.name).toHaveLength(1);
        expectSyntheticFailure(findings[0]);
        expect(findings[0]?.body).toContain("Sovri could not parse the LLM response");
      }),
    );
  });

  it("returns synthetic failure when the retry provider rejects", async () => {
    const provider = createProvider([new Error("provider timeout")]);

    // Given the retry provider rejects with message "provider timeout"
    const findings = await parseWithRetry(schemaInvalidResponse(), provider, retryPrompts);

    // Then the returned findings contain 1 synthetic failure finding
    expect(findings).toHaveLength(1);
    expectSyntheticFailure(findings[0]);

    // And the synthetic failure finding body contains "provider timeout"
    expect(findings[0]?.body).toContain("provider timeout");
  });

  it("continues retrying when a corrective provider response fails parsing", async () => {
    const provider = createProvider([
      new AnthropicResponseError("Anthropic response was not valid JSON", {
        cause: new SyntaxError("Unexpected token <"),
      }),
      buildResponse(),
    ]);

    // Given the retry budget is 2
    const findings = await parseWithRetry(schemaInvalidResponse(), provider, retryPrompts, {
      retryBudget: 2,
    });

    // Then the provider is called 2 times
    expect(provider.calls).toHaveLength(2);

    // And the returned findings contain 1 corrected finding
    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toBe("Retry fixed response");
    expect(provider.calls[1]?.systemPrompt).toContain("JSON syntax error: Unexpected token <");
  });
});
