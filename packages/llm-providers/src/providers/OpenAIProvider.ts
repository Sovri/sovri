// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import OpenAI, { APIError, AuthenticationError, PermissionDeniedError } from "openai";
import type {
  ChatCompletionCreateParamsNonStreaming,
  Completions,
} from "openai/resources/chat/completions";

import type {
  GenerateStructuredParams,
  LLMProvider,
  StructuredGeneration,
} from "../types/LLMProvider.js";
import {
  OpenAIProviderAuthError,
  OpenAIProviderError,
  type OpenAIProviderErrorOptions,
} from "./OpenAIProvider.errors.js";
import {
  createOpenAIClientOptions,
  resolveMaxTokens,
  resolveOpenAIProviderOptions,
  type OpenAIProviderConfigOptions,
} from "./OpenAIProvider.options.js";
import {
  createOpenAIJsonSchemaResponseFormat,
  extractOpenAITokenUsage,
  parseStructuredOpenAIResponse,
} from "./OpenAIProvider.response.js";

export {
  OpenAIProviderAuthError,
  OpenAIProviderError,
  type OpenAIProviderErrorOptions,
} from "./OpenAIProvider.errors.js";
export {
  DEFAULT_OPENAI_MAX_ATTEMPTS,
  DEFAULT_OPENAI_MAX_TOKENS,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_OPENAI_TIMEOUT_MS,
  MAX_OPENAI_MAX_TOKENS,
  MAX_OPENAI_TIMEOUT_MS,
} from "./OpenAIProvider.options.js";

export type OpenAIChatComplete = Completions["create"];
export type OpenAIChatRequest = ChatCompletionCreateParamsNonStreaming;

export interface OpenAIChatClient {
  readonly chat: {
    readonly completions: {
      readonly create: OpenAIChatComplete;
    };
  };
}

export interface OpenAIProviderOptions extends OpenAIProviderConfigOptions {
  readonly client?: OpenAIChatClient;
}

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  readonly model: string;
  readonly maxTokens: number;
  readonly timeoutMs: number;
  readonly maxAttempts: number;

  private readonly client: OpenAIChatClient;

  constructor(options: OpenAIProviderOptions) {
    const resolvedOptions = resolveOpenAIProviderOptions(options);

    this.model = resolvedOptions.model;
    this.maxTokens = resolvedOptions.maxTokens;
    this.timeoutMs = resolvedOptions.timeoutMs;
    this.maxAttempts = resolvedOptions.maxAttempts;
    this.client =
      options.client ??
      new OpenAI(createOpenAIClientOptions(resolvedOptions.apiKey, resolvedOptions.timeoutMs));
  }

  async generateStructured<T>(params: GenerateStructuredParams<T>): Promise<T> {
    const result = await this.generateStructuredWithUsage(params);

    return result.data;
  }

  async generateStructuredWithUsage<T>(
    params: GenerateStructuredParams<T>,
  ): Promise<StructuredGeneration<T>> {
    const response = await this.createChatCompletion(params);
    const tokenUsage = extractOpenAITokenUsage(response);
    const data = parseStructuredOpenAIResponse(response, params.schema, tokenUsage);

    return { data, tokenUsage };
  }

  private async createChatCompletion<T>(params: GenerateStructuredParams<T>): Promise<unknown> {
    const request = this.createRequest(params);

    try {
      return await this.client.chat.completions.create(request, {
        maxRetries: 0,
      });
    } catch (cause) {
      throw createOpenAIRequestError(cause);
    }
  }

  private createRequest<T>(params: GenerateStructuredParams<T>): OpenAIChatRequest {
    const request: OpenAIChatRequest = {
      model: this.model,
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userPrompt },
      ],
      max_completion_tokens: resolveMaxTokens(params.maxTokens ?? this.maxTokens),
      response_format: createOpenAIJsonSchemaResponseFormat(params.schema),
      stream: false,
    };

    if (params.temperature !== undefined) {
      request.temperature = params.temperature;
    }

    return request;
  }
}

function createOpenAIRequestError(
  cause: unknown,
): OpenAIProviderError<"OpenAIProviderError" | "OpenAIProviderAuthError"> {
  const options = openAIRequestErrorOptions(cause);

  if (isOpenAIAuthFailure(cause)) {
    return new OpenAIProviderAuthError("OpenAI request failed authentication", options);
  }

  return new OpenAIProviderError(openAIRequestErrorMessage(cause), options);
}

function openAIRequestErrorOptions(cause: unknown): OpenAIProviderErrorOptions {
  if (!(cause instanceof APIError)) {
    return { cause };
  }

  return {
    cause,
    ...(cause.status !== undefined ? { status: cause.status } : {}),
    ...(cause.requestID !== undefined ? { requestId: cause.requestID } : {}),
    ...(cause.code !== undefined ? { code: cause.code } : {}),
  };
}

function openAIRequestErrorMessage(cause: unknown): string {
  if (cause instanceof APIError && cause.status !== undefined) {
    return `OpenAI request failed with status ${String(cause.status)}`;
  }

  return "OpenAI request failed";
}

function isOpenAIAuthFailure(cause: unknown): boolean {
  return cause instanceof AuthenticationError || cause instanceof PermissionDeniedError;
}
