// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { afterEach, describe, expect, it, vi } from "vitest";

import { retryWithBackoff, type AttemptContext, type RetryOptions } from "./retry.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("retryWithBackoff — happy first attempt", () => {
  it("returns the first attempt result without retrying or sleeping between attempts", async () => {
    // Given the retry helper is configured with max 3 total attempts
    // And the retry helper is configured with a base delay of 500 ms
    // And the retry helper is configured with a timeout of 60000 ms
    const opts: RetryOptions = {
      maxAttempts: 3,
      baseDelayMs: 500,
      timeoutMs: 60_000,
      isRetryable: () => false,
    };

    // And the operation resolves with value "ok" on the first attempt
    const captured: AttemptContext[] = [];
    const fn = vi.fn(async (ctx: AttemptContext) => {
      captured.push(ctx);
      return "ok";
    });

    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    // When the caller invokes the retry helper once
    const result = await retryWithBackoff(fn, opts);

    // Then the retry helper returns "ok"
    expect(result).toBe("ok");

    // And exactly 1 attempt is executed
    expect(fn).toHaveBeenCalledTimes(1);

    // And the AttemptContext captured on attempt 1 reports attempt number 1
    expect(captured[0]?.attempt).toBe(1);

    // And the AttemptContext captured on attempt 1 reports a remaining budget of 60000 ms
    expect(captured[0]?.timeoutMs).toBe(60_000);

    // And the AttemptContext captured on attempt 1 has a fresh, non-aborted AbortSignal
    expect(captured[0]?.signal).toBeInstanceOf(AbortSignal);
    expect(captured[0]?.signal.aborted).toBe(false);

    // And the retry helper does not sleep between attempts
    //   (any setTimeout scheduled with a delay shorter than the per-attempt
    //   budget would indicate a retry sleep; only the per-attempt deadline
    //   timer, scheduled for `opts.timeoutMs`, is allowed)
    const shortDelayCalls = setTimeoutSpy.mock.calls.filter((args) => {
      const delay = args[1];
      return typeof delay === "number" && delay < opts.timeoutMs;
    });
    expect(shortDelayCalls).toEqual([]);
  });
});
