// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri contributors

import { FindingSchema } from "@sovri/core";
import { describe, expect, it } from "vitest";

import { parseWithRetry, RetryBudgetValidationError } from "./retry.js";
import {
  buildRawFinding,
  buildResponse,
  createProvider,
  invalidSeverityResponse,
  malformedJson,
  retryPrompts,
  schemaInvalidResponse,
} from "./retry.test-helpers.js";

describe("parseWithRetry", () => {
  it("returns parsed findings and does not call the provider for a valid first response", async () => {
    const provider = createProvider([]);
    const initialResponse = buildResponse([
      buildRawFinding({
        file: "src/cards.ts",
        title: "Valid first response",
      }),
    ]);

    // When the maintainer calls `parseWithRetry`
    const findings = await parseWithRetry(initialResponse, provider, retryPrompts);

    // Then the returned value is a `Finding[]`
    expect(Array.isArray(findings)).toBe(true);
    expect(findings).toHaveLength(1);

    // And the returned finding validates against `FindingSchema`
    expect(FindingSchema.parse(findings[0])).toEqual(findings[0]);

    // And the provider is called 0 times
    expect(provider.calls).toHaveLength(0);
  });

  it("returns an empty Finding array for a valid first response with zero findings", async () => {
    const provider = createProvider([]);

    // Given the initial LLM response contains 0 findings
    const findings = await parseWithRetry(buildResponse([]), provider, retryPrompts);

    // Then the returned findings contain 0 findings
    expect(findings).toEqual([]);

    // And the provider is called 0 times
    expect(provider.calls).toHaveLength(0);
  });

  it("retries schema-invalid responses with a corrective prompt and returns retry findings", async () => {
    const provider = createProvider([
      buildResponse([buildRawFinding({ file: "src/payments.ts" })]),
    ]);

    // Given the initial LLM response contains a finding with line_start 22 and line_end 20
    const initialResponse = {
      summary: "Broken response",
      findings: [buildRawFinding({ line_start: 22, line_end: 20 })],
    };

    // When the maintainer calls `parseWithRetry`
    const findings = await parseWithRetry(initialResponse, provider, retryPrompts);

    // Then the provider is called 1 time
    expect(provider.calls).toHaveLength(1);

    // And the provider call user prompt equals the original user prompt
    expect(provider.calls[0]?.userPrompt).toBe(retryPrompts.userPrompt);

    // And the provider call system prompt contains "findings.0.line_end"
    expect(provider.calls[0]?.systemPrompt).toContain("findings.0.line_end");
    expect(provider.calls[0]?.systemPrompt).toContain("Correct the previous LLM response");

    // And the returned findings contain the parsed valid finding
    expect(findings[0]?.file).toBe("src/payments.ts");
  });

  it("includes JSON syntax details when malformed JSON triggers a retry", async () => {
    const provider = createProvider([buildResponse([buildRawFinding({ file: "src/schema.ts" })])]);

    // Given the initial LLM response is malformed JSON
    const findings = await parseWithRetry(malformedJson(), provider, retryPrompts);

    // Then the provider call system prompt contains "JSON syntax"
    expect(provider.calls[0]?.systemPrompt).toContain("JSON syntax");

    // And the provider call system prompt contains "no Zod issue list is available"
    expect(provider.calls[0]?.systemPrompt).toContain("no Zod issue list is available");
    expect(findings[0]?.file).toBe("src/schema.ts");
  });

  it("creates two provider calls when budget two needs the second retry", async () => {
    const provider = createProvider([invalidSeverityResponse(), buildResponse()]);

    // Given the retry budget is 2
    const findings = await parseWithRetry(schemaInvalidResponse(), provider, retryPrompts, {
      retryBudget: 2,
    });

    // Then the provider is called 2 times
    expect(provider.calls).toHaveLength(2);

    // And each provider call has a corrective system prompt
    expect(
      provider.calls.every(({ systemPrompt }) => systemPrompt.includes("Correct the previous")),
    ).toBe(true);
    expect(findings[0]?.title).toBe("Retry fixed response");
  });

  it("rejects invalid retry budgets before parsing or provider calls", async () => {
    const provider = createProvider([]);

    await Promise.all(
      [-1, 1.5].map(async (retryBudget) => {
        const promise = parseWithRetry(buildResponse(), provider, retryPrompts, { retryBudget });
        await expect(promise).rejects.toBeInstanceOf(RetryBudgetValidationError);
      }),
    );

    // And the provider is called 0 times
    expect(provider.calls).toHaveLength(0);
  });
});
