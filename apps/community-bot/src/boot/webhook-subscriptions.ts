// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri contributors

// Webhook subscription self-check. At boot the bot compares the webhook events its registered
// handlers require against the events the GitHub App is actually subscribed to, so a missing
// subscription (which silently drops @sovri-bot commands) is surfaced instead of failing silently.

/**
 * Compute which of the {@link required} webhook events are not present in {@link subscribed}.
 * Pure set difference, preserving the order of {@link required}.
 */
export function computeMissingWebhookEvents(
  required: readonly string[],
  subscribed: readonly string[],
): readonly string[] {
  const subscribedEvents = new Set(subscribed);
  return required.filter((event) => !subscribedEvents.has(event));
}
