// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri contributors

import type { z } from "@sovri/core";

import type { TokenUsage } from "../types/LLMProvider.js";
import { errorOptions } from "../errors-internal.js";

export interface MistralProviderErrorOptions {
  readonly cause?: unknown;
  readonly status?: number;
  readonly requestId?: string | null;
  readonly attemptDurationsMs?: ReadonlyArray<number>;
  readonly issues?: ReadonlyArray<z.core.$ZodIssue>;
  readonly tokenUsage?: TokenUsage;
  readonly retryableWithCorrectivePrompt?: true;
}

export class MistralProviderError extends Error {
  readonly status?: number;
  readonly requestId?: string | null;
  readonly attemptDurationsMs?: ReadonlyArray<number>;
  readonly issues?: ReadonlyArray<z.core.$ZodIssue>;
  readonly tokenUsage?: TokenUsage;
  readonly retryableWithCorrectivePrompt?: true;

  override get name(): "MistralProviderError" {
    return "MistralProviderError";
  }

  constructor(message: string, options: MistralProviderErrorOptions = {}) {
    super(message, errorOptions(options.cause));
    applyMistralErrorOptions(this, options);
  }
}

export class MistralProviderRetryError extends Error {
  readonly status?: number;
  readonly requestId?: string | null;
  readonly attemptDurationsMs?: ReadonlyArray<number>;

  override get name(): "MistralProviderRetryError" {
    return "MistralProviderRetryError";
  }

  constructor(message: string, options: MistralProviderErrorOptions = {}) {
    super(message, errorOptions(options.cause));
    applyMistralErrorOptions(this, options);
  }
}

export class MistralProviderTimeoutError extends Error {
  readonly status?: number;
  readonly requestId?: string | null;
  readonly attemptDurationsMs?: ReadonlyArray<number>;

  override get name(): "MistralProviderTimeoutError" {
    return "MistralProviderTimeoutError";
  }

  constructor(message: string, options: MistralProviderErrorOptions = {}) {
    super(message, errorOptions(options.cause));
    applyMistralErrorOptions(this, options);
  }
}

function applyMistralErrorOptions(
  error: MistralProviderError | MistralProviderRetryError | MistralProviderTimeoutError,
  options: MistralProviderErrorOptions,
): void {
  defineEnumerableOption(error, "status", options.status);
  defineEnumerableOption(error, "requestId", options.requestId);
  defineEnumerableOption(
    error,
    "attemptDurationsMs",
    options.attemptDurationsMs === undefined ? undefined : [...options.attemptDurationsMs],
  );
  if (!(error instanceof MistralProviderError)) {
    return;
  }

  defineEnumerableOption(error, "issues", options.issues);
  defineEnumerableOption(error, "tokenUsage", options.tokenUsage);
  defineEnumerableOption(
    error,
    "retryableWithCorrectivePrompt",
    options.retryableWithCorrectivePrompt,
  );
}

function defineEnumerableOption(error: Error, key: string, value: unknown): void {
  if (value !== undefined) {
    Object.defineProperty(error, key, { value, enumerable: true });
  }
}
