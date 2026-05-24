// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import type { SovriConfig } from "@sovri/config";

import { AnthropicProvider } from "./providers/AnthropicProvider.js";
import { MistralProvider } from "./providers/MistralProvider.js";
import type { LLMProvider } from "./types/LLMProvider.js";

export function createProviderFromConfig(config: SovriConfig, env: NodeJS.ProcessEnv): LLMProvider {
  const apiKey = readApiKey(config.llm.apiKeySecret, env);

  switch (config.llm.provider) {
    case "anthropic":
      return new AnthropicProvider({
        env: { ANTHROPIC_API_KEY: apiKey },
        model: config.llm.model,
      });
    case "mistral":
      return createMistralProvider(config, apiKey);
  }
}

function createMistralProvider(config: SovriConfig, apiKey: string): MistralProvider {
  if (config.llm.baseUrl !== undefined) {
    return new MistralProvider({
      apiKey,
      baseUrl: config.llm.baseUrl,
      model: config.llm.model,
    });
  }

  return new MistralProvider({
    apiKey,
    model: config.llm.model,
  });
}

function readApiKey(apiKeySecret: string, env: NodeJS.ProcessEnv): string {
  const apiKey = env[apiKeySecret]?.trim();

  if (apiKey === undefined || apiKey.length === 0) {
    throw new Error(`${apiKeySecret} must be set`);
  }

  return apiKey;
}
