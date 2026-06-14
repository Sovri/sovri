// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri contributors

import { describe, expect, it } from "vitest";

import { computeMissingWebhookEvents } from "./webhook-subscriptions.js";

// Acceptance test for GitHub issue #2578 (bug-2504, rule R-01,
// r01-detect-required-vs-subscribed.feature). At boot the bot determines the set of webhook events
// its registered handlers require, and compares it against the App's actually subscribed events.
// Pure detection kernel: required \ subscribed -> missing. No I/O, no framework adapters.

// Background: the bot's registered handlers require the webhook events "pull_request" and
// "issue_comment".
const REQUIRED: readonly string[] = ["pull_request", "issue_comment"];

describe("computeMissingWebhookEvents (R-01)", () => {
  it("reports no missing events when all required events are subscribed", () => {
    // Given the GitHub App is subscribed to the events "pull_request, issue_comment"
    // When the bot computes which required events are missing
    // Then the missing events are ""
    expect(computeMissingWebhookEvents(REQUIRED, ["pull_request", "issue_comment"])).toEqual([]);
  });

  it("reports issue_comment as missing when the command event is not subscribed", () => {
    // Given the GitHub App is subscribed to the events "issues, pull_request"
    // When the bot computes which required events are missing
    // Then the missing events are "issue_comment"
    expect(computeMissingWebhookEvents(REQUIRED, ["issues", "pull_request"])).toEqual([
      "issue_comment",
    ]);
  });

  // Scenario Outline: Missing set across subscription shapes.
  it.each<{ subscribed: readonly string[]; missing: readonly string[] }>([
    { subscribed: ["pull_request", "issue_comment"], missing: [] },
    { subscribed: ["pull_request", "issue_comment", "push"], missing: [] },
    { subscribed: ["issues", "pull_request"], missing: ["issue_comment"] },
    { subscribed: ["issues", "issue_comment"], missing: ["pull_request"] },
    { subscribed: ["push"], missing: ["pull_request", "issue_comment"] },
    { subscribed: [], missing: ["pull_request", "issue_comment"] },
  ])("given subscribed $subscribed the missing events are $missing", ({ subscribed, missing }) => {
    // When the bot computes which required events are missing
    // Then the missing events match the expected set, ordered as required
    expect(computeMissingWebhookEvents(REQUIRED, subscribed)).toEqual(missing);
  });
});
