// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { DEFAULT_CONFIG, type SovriConfig } from "@sovri/config";
import { AnthropicProvider } from "@sovri/llm-providers";
import { createLogger } from "@sovri/observability";
import {
  parseUnifiedDiff,
  reviewPullRequest,
  type Review,
  type ReviewPullRequestOptions,
} from "@sovri/review-engine";

import type {
  PullRequestHandlerDependencies,
  PullRequestWebhookContext,
  ReviewPostTarget,
} from "../handlers/pull-request.js";

const logger = createLogger("community-bot.pull-request");

export function createPullRequestHandlerDependencies(
  context: PullRequestWebhookContext,
  env: NodeJS.ProcessEnv = process.env,
): PullRequestHandlerDependencies {
  return {
    buildReviewOptions: (config) => buildReviewOptions(config, env),
    fetchDiff: (target) => fetchPullRequestDiff(context, target),
    loadConfig: async () => DEFAULT_CONFIG,
    logger,
    postErrorComment: (target, message) => postErrorComment(context, target, message),
    postReview: (target, review) => postReview(context, target, review),
    reviewPullRequest,
  };
}

async function fetchPullRequestDiff(context: PullRequestWebhookContext, target: ReviewPostTarget) {
  const repo = splitRepoFullName(target.repoFullName);
  const response = await context.octokit.request<string>(
    "GET /repos/{owner}/{repo}/pulls/{pull_number}",
    {
      mediaType: {
        format: "diff",
      },
      owner: repo.owner,
      pull_number: target.number,
      repo: repo.repo,
    },
  );

  return parseUnifiedDiff(response.data);
}

async function postReview(
  context: PullRequestWebhookContext,
  target: ReviewPostTarget,
  review: Review,
): Promise<void> {
  const repo = splitRepoFullName(target.repoFullName);
  await context.octokit.rest.pulls.createReview({
    body: review.walkthrough_markdown,
    commit_id: target.commitSha,
    event: "COMMENT",
    owner: repo.owner,
    pull_number: target.number,
    repo: repo.repo,
  });
}

async function postErrorComment(
  context: PullRequestWebhookContext,
  target: ReviewPostTarget,
  message: string,
): Promise<void> {
  const repo = splitRepoFullName(target.repoFullName);
  await context.octokit.rest.issues.createComment({
    body: message,
    issue_number: target.number,
    owner: repo.owner,
    repo: repo.repo,
  });
}

function buildReviewOptions(config: SovriConfig, env: NodeJS.ProcessEnv): ReviewPullRequestOptions {
  return {
    logger,
    provider: createProvider(config, env),
  };
}

function createProvider(config: SovriConfig, env: NodeJS.ProcessEnv): AnthropicProvider {
  if (config.llm.provider !== "anthropic") {
    throw new PullRequestReviewAdapterError("Unsupported LLM provider");
  }

  return new AnthropicProvider({
    env: buildAnthropicEnv(config, env),
  });
}

function buildAnthropicEnv(config: SovriConfig, env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const apiKey = env[config.llm.apiKeySecret]?.trim();
  if (apiKey === undefined || apiKey.length === 0) {
    throw new PullRequestReviewAdapterError(`${config.llm.apiKeySecret} must be set`);
  }

  return {
    ANTHROPIC_API_KEY: apiKey,
  };
}

function splitRepoFullName(repoFullName: string): {
  readonly owner: string;
  readonly repo: string;
} {
  const parts = repoFullName.split("/");
  const owner = parts[0];
  const repo = parts[1];

  if (owner === undefined || repo === undefined || owner.length === 0 || repo.length === 0) {
    throw new PullRequestReviewAdapterError("Repository full name is invalid");
  }

  return { owner, repo };
}

class PullRequestReviewAdapterError extends Error {
  public override readonly name = "PullRequestReviewAdapterError";
}
