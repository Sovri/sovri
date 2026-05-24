// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

export interface AttemptContext {
  readonly signal: AbortSignal;
  readonly timeoutMs: number;
  readonly attempt: number;
}

export interface RetryOptions {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly timeoutMs: number;
  readonly isRetryable: (err: unknown) => boolean;
}

export async function retryWithBackoff<T>(
  _fn: (ctx: AttemptContext) => Promise<T>,
  _opts: RetryOptions,
): Promise<T> {
  throw new Error("retryWithBackoff: not implemented");
}
