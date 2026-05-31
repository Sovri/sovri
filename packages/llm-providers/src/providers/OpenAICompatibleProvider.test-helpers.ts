// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import type { LLMProvider } from "../types/LLMProvider.js";

export interface FakeOpenAIChatClient {
  readonly chat: {
    readonly completions: {
      readonly create: (request: unknown, options?: unknown) => Promise<unknown>;
    };
  };
}

export interface OpenAICompatibleProviderOptions {
  readonly apiKey: string;
  readonly model?: string;
  readonly baseUrl?: string;
  readonly client?: FakeOpenAIChatClient;
}

export interface OpenAICompatibleProviderExports {
  readonly createOpenAICompatibleProvider: (
    options: OpenAICompatibleProviderOptions,
  ) => LLMProvider;
  readonly OpenAIProviderError: ErrorConstructor;
}

export async function openAICompatibleProviderExports(): Promise<OpenAICompatibleProviderExports> {
  const module = await import("../index.js");
  const createOpenAICompatibleProvider = Reflect.get(module, "createOpenAICompatibleProvider");
  const OpenAIProviderError = Reflect.get(module, "OpenAIProviderError");

  if (typeof createOpenAICompatibleProvider !== "function") {
    throw new Error("createOpenAICompatibleProvider export is missing");
  }
  if (!isErrorConstructor(OpenAIProviderError)) {
    throw new Error("OpenAIProviderError export is missing");
  }

  return {
    createOpenAICompatibleProvider: (options) =>
      requireLLMProvider(Reflect.apply(createOpenAICompatibleProvider, undefined, [options])),
    OpenAIProviderError,
  };
}

export function mockOpenAIModule(sdkConstructorOptions: unknown[]): Record<string, unknown> {
  class MockOpenAI {
    readonly chat = {
      completions: {
        create: async () => {
          throw new Error("Mock OpenAI-compatible client should not receive construction calls");
        },
      },
    };

    constructor(options: unknown) {
      sdkConstructorOptions.push(options);
    }
  }

  class MockAPIError extends Error {}
  class MockAPIConnectionError extends MockAPIError {}
  class MockAPIConnectionTimeoutError extends MockAPIError {}
  class MockAuthenticationError extends MockAPIError {}
  class MockPermissionDeniedError extends MockAPIError {}

  return {
    default: MockOpenAI,
    APIConnectionError: MockAPIConnectionError,
    APIConnectionTimeoutError: MockAPIConnectionTimeoutError,
    APIError: MockAPIError,
    AuthenticationError: MockAuthenticationError,
    PermissionDeniedError: MockPermissionDeniedError,
  };
}

export function captureError(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }

  throw new Error("Expected constructor to throw");
}

export function isErrorConstructor(value: unknown): value is ErrorConstructor {
  return typeof value === "function" && value.prototype instanceof Error;
}

function requireLLMProvider(value: unknown): LLMProvider {
  if (!isLLMProvider(value)) {
    throw new Error("createOpenAICompatibleProvider returned an invalid provider");
  }

  return value;
}

function isLLMProvider(value: unknown): value is LLMProvider {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value["name"] === "string" &&
    typeof value["model"] === "string" &&
    typeof value["maxTokens"] === "number" &&
    typeof value["generateStructured"] === "function"
  );
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
