// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { z } from "@sovri/core";
import { describe, expect, it } from "vitest";

import * as LlmProviders from "../index.js";
import type { LLMProvider } from "../types/LLMProvider.js";
import { OpenAIProviderError } from "./OpenAIProvider.js";

const TestApiKey = "test-openai-key";

interface FakeOpenAIChatClient {
  readonly chat: {
    readonly completions: {
      readonly create: (request: unknown, options?: unknown) => Promise<unknown>;
    };
  };
}

interface OpenAIProviderConstructor {
  new (options: { readonly apiKey: string; readonly client: FakeOpenAIChatClient }): LLMProvider;
}

const validParams = {
  systemPrompt: "Review code safely.",
  userPrompt: "diff --git a/src/auth.ts b/src/auth.ts",
  schema: z.strictObject({ summary: z.string() }),
};

describe("OpenAIProvider schema conversion", () => {
  it("fails unsupported schema conversion before sending a request", async () => {
    const calls: unknown[] = [];
    const provider = newProvider(calls);

    const error = await captureAsyncOpenAIProviderError(
      provider.generateStructured({
        ...validParams,
        schema: z.function({ input: [], output: z.string() }),
      }),
    );

    expect(error.name).toBe("OpenAIProviderError");
    expect(error.message).toContain("response schema");
    expect(calls).toEqual([]);
  });

  it("rejects schemas whose JSON Schema root is not an object", async () => {
    const calls: unknown[] = [];
    const provider = newProvider(calls);

    const error = await captureAsyncOpenAIProviderError(
      provider.generateStructured({ ...validParams, schema: z.string() }),
    );

    expect(error.name).toBe("OpenAIProviderError");
    expect(error.message).toContain("object schema");
    expect(calls).toEqual([]);
  });
});

function newProvider(calls: unknown[]): LLMProvider {
  const Provider = openAIProviderConstructor();

  return new Provider({
    apiKey: TestApiKey,
    client: fakeOpenAIClient(calls),
  });
}

function openAIProviderConstructor(): OpenAIProviderConstructor {
  const exportedProvider = Reflect.get(LlmProviders, "OpenAIProvider");
  if (!isOpenAIProviderConstructor(exportedProvider)) {
    throw new Error("OpenAIProvider export is missing");
  }

  return exportedProvider;
}

function isOpenAIProviderConstructor(value: unknown): value is OpenAIProviderConstructor {
  return typeof value === "function";
}

function fakeOpenAIClient(calls: unknown[]): FakeOpenAIChatClient {
  return {
    chat: {
      completions: {
        create: async (request) => {
          calls.push(request);
          return {
            choices: [{ message: { content: JSON.stringify({ summary: "Reviewed" }) } }],
            usage: {
              prompt_tokens: 123,
              completion_tokens: 45,
            },
          };
        },
      },
    },
  };
}

async function captureAsyncOpenAIProviderError(
  promise: Promise<unknown>,
): Promise<OpenAIProviderError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof OpenAIProviderError) {
      return error;
    }

    throw error;
  }

  throw new Error("Expected OpenAIProviderError");
}
