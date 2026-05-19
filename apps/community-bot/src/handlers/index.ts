// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { createPullRequestHandlerDependencies } from "../github/pull-request-review.js";
import {
  handlePullRequestOpened,
  handlePullRequestSynchronize,
  type PullRequestHandlerDependencies,
  type PullRequestWebhookContext,
} from "./pull-request.js";

type PullRequestEventName = "pull_request.opened" | "pull_request.synchronize";
type PullRequestWebhookHandler = (context: PullRequestWebhookContext) => Promise<void>;
type PullRequestDependencyFactory = (
  context: PullRequestWebhookContext,
) => PullRequestHandlerDependencies;

export type PullRequestWebhookRegistrar = {
  readonly on: (eventName: PullRequestEventName, handler: PullRequestWebhookHandler) => void;
};

export function registerWebhookHandlers(
  app: PullRequestWebhookRegistrar,
  createDependencies: PullRequestDependencyFactory = createPullRequestHandlerDependencies,
): void {
  app.on("pull_request.opened", async (context) => {
    await handlePullRequestOpened(context, createDependencies(context));
  });

  app.on("pull_request.synchronize", async (context) => {
    await handlePullRequestSynchronize(context, createDependencies(context));
  });
}
