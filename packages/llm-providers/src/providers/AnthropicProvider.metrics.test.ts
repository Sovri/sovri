// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri contributors

// Acceptance test for the provider-side Sovri business metrics (GitHub issue #2419, R-01..R-10).
// Mirrors specs/task-128-business-metrics/business-metrics.feature for the two metrics emitted inside
// the adapter: sovri.llm.tokens (per direction, per LLM call) and sovri.llm.errors (per typed error
// class). They are emitted here — not in the orchestrator — because the orchestrator flattens the
// typed provider error to a message before it sees it, so error_type can only be class-derived at the
// adapter. Emission is observed by capturing the recordMetric export of @sovri/observability.

import { z } from "@sovri/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AnthropicAuthError,
  AnthropicResponseError,
  AnthropicRetryError,
  AnthropicTimeoutError,
} from "../errors.js";
import { AnthropicProvider, DEFAULT_ANTHROPIC_MODEL } from "./AnthropicProvider.js";
import type { AnthropicMessagesClient } from "./AnthropicProvider.retry.js";

// --- recordMetric capture ---------------------------------------------------

interface MetricCall {
  readonly name: string;
  readonly kind: string;
  readonly value: number;
  readonly tags: Record<string, string>;
}

const metrics = vi.hoisted(() => {
  const calls: MetricCall[] = [];
  function recordMetric(
    descriptor: { name: string; kind: string },
    value: number,
    tags?: Record<string, string>,
  ): void {
    calls.push({ name: descriptor.name, kind: descriptor.kind, value, tags: { ...tags } });
  }
  return {
    calls,
    recordMetric,
    reset(): void {
      calls.length = 0;
    },
  };
});

vi.mock("@sovri/observability", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@sovri/observability")>();
  return { ...actual, recordMetric: metrics.recordMetric };
});

beforeEach(() => {
  metrics.reset();
});

// --- helpers / fixtures -----------------------------------------------------

const METRIC = { tokens: "sovri.llm.tokens", errors: "sovri.llm.errors" } as const;

function callsFor(name: string): MetricCall[] {
  return metrics.calls.filter((call) => call.name === name);
}

const schema = z.object({ ok: z.boolean() });
const params = { systemPrompt: "system", userPrompt: "user", schema, maxTokens: 2048 };

function okClient(): AnthropicMessagesClient {
  return {
    messages: {
      create: async () => ({
        content: [{ type: "text", text: '{"ok":true}' }],
        usage: { input_tokens: 1200, output_tokens: 340 },
      }),
    },
  };
}

function throwingClient(error: unknown): AnthropicMessagesClient {
  return {
    messages: {
      create: async () => {
        throw error;
      },
    },
  };
}

// --- R-04 / R-06 (token emission) -------------------------------------------

describe("R-06 — sovri.llm.tokens is emitted once per direction per LLM call", () => {
  it("emits prompt and completion counts tagged with the provider's own name and model", async () => {
    // Given the provider reports token usage prompt 1200, completion 340
    const provider = new AnthropicProvider({ client: okClient() });

    // When a generation succeeds
    const result = await provider.generateStructuredWithUsage(params);
    expect(result.tokenUsage).toEqual({ prompt: 1200, completion: 340 });

    // Then sovri.llm.tokens is emitted exactly twice, once per direction
    const tokens = callsFor(METRIC.tokens);
    expect(tokens).toHaveLength(2);
    expect(tokens.every((c) => c.kind === "counter")).toBe(true);

    // And R-04: provider/model come from the provider's own name/model
    const prompt = tokens.find((c) => c.tags["direction"] === "prompt");
    const completion = tokens.find((c) => c.tags["direction"] === "completion");
    expect(prompt?.tags).toEqual({
      provider: "anthropic",
      model: DEFAULT_ANTHROPIC_MODEL,
      direction: "prompt",
    });
    expect(prompt?.value).toBe(1200);
    expect(completion?.tags).toEqual({
      provider: "anthropic",
      model: DEFAULT_ANTHROPIC_MODEL,
      direction: "completion",
    });
    expect(completion?.value).toBe(340);

    // And no error metric is emitted on the success path
    expect(callsFor(METRIC.errors)).toHaveLength(0);
  });
});

// --- R-06 / R-07 (error emission) -------------------------------------------

describe("R-06/R-07 — sovri.llm.errors is emitted once per LLM error, class-derived, never leaking", () => {
  it("emits one llm.errors with provider/error_type and keeps the error message out of the tags", async () => {
    // Given the LLM call fails with an error whose message carries a marker
    const provider = new AnthropicProvider({
      client: throwingClient(new Error("network boom LEAK_ERR_4A8C")),
    });

    // When the adapter records the failure
    await expect(provider.generateStructuredWithUsage(params)).rejects.toBeInstanceOf(
      AnthropicResponseError,
    );

    // Then sovri.llm.errors is emitted exactly once, tagged provider + a class-derived error_type
    const errors = callsFor(METRIC.errors);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.kind).toBe("counter");
    expect(Object.keys(errors[0]?.tags ?? {}).toSorted()).toEqual(["error_type", "provider"]);
    expect(errors[0]?.tags["provider"]).toBe("anthropic");
    expect(errors[0]?.tags["error_type"]).toBe("response");

    // And no tag value contains the error message marker (R-07)
    const text = metrics.calls.map((c) => Object.values(c.tags).join(",")).join("|");
    expect(text).not.toContain("LEAK_ERR_4A8C");

    // And no token metric is emitted on the error path
    expect(callsFor(METRIC.tokens)).toHaveLength(0);
  });
});

// --- R-07 / R-02 / R-03 / R-08 / R-10 (provider metrics helper, dynamic) ----

describe("R-07/R-02/R-03/R-08/R-10 — the provider metrics helper and typed wrappers", () => {
  it.each([
    { error: new AnthropicAuthError("x"), errorType: "auth" },
    { error: new AnthropicResponseError("x"), errorType: "response" },
    { error: new AnthropicRetryError("x"), errorType: "retry" },
    { error: new AnthropicTimeoutError("x"), errorType: "timeout" },
    { error: new Error("x"), errorType: "unknown" },
  ])("maps the typed error class to error_type $errorType (R-07)", async ({ error, errorType }) => {
    const helper = await import("../metrics.js");
    expect(helper.llmErrorType(error)).toBe(errorType);
  });

  it("rejects an out-of-enum direction and emits nothing (R-03)", async () => {
    const helper = await import("../metrics.js");
    metrics.reset();
    helper.recordLlmTokens(
      { provider: "anthropic", model: "m", direction: "streaming" } as never,
      1,
    );
    expect(callsFor(METRIC.tokens)).toHaveLength(0);
  });

  it("rejects an unknown tag key and emits nothing (R-02)", async () => {
    const helper = await import("../metrics.js");
    metrics.reset();
    helper.recordLlmTokens(
      { provider: "anthropic", model: "m", direction: "prompt", repo: "mpiton/sovri" } as never,
      1,
    );
    expect(callsFor(METRIC.tokens)).toHaveLength(0);
  });

  it("rejects an out-of-enum error_type and emits nothing (R-03)", async () => {
    const helper = await import("../metrics.js");
    metrics.reset();
    helper.recordLlmError({ provider: "anthropic", error_type: "500" } as never);
    expect(callsFor(METRIC.errors)).toHaveLength(0);
  });

  it("emits via the typed wrapper with the registry name and counter kind for a valid tag bag (R-08)", async () => {
    const helper = await import("../metrics.js");
    metrics.reset();
    helper.recordLlmTokens({ provider: "anthropic", model: "m", direction: "completion" }, 340);
    expect(callsFor(METRIC.tokens)).toHaveLength(1);
    expect(callsFor(METRIC.tokens)[0]?.kind).toBe("counter");
    expect(callsFor(METRIC.tokens)[0]?.value).toBe(340);
  });

  it("the provider metrics source carries the SPDX header and uses no type/lint escapes (R-10)", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("../metrics.ts", import.meta.url), "utf8");
    expect(
      source.startsWith(
        "// SPDX-License-Identifier: Apache-2.0\n// Copyright 2026 Sovri contributors",
      ),
    ).toBe(true);
    expect(source).not.toMatch(/@ts-(ignore|expect-error)/u);
    expect(source).not.toMatch(/oxlint-disable/u);
    for (const relativeImport of source.match(/from\s+"\.[^"]*"/gu) ?? []) {
      expect(relativeImport).toMatch(/\.js"$/u);
    }
  });
});
