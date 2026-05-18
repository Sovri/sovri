// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import type { SovriConfig } from "@sovri/config";
import type {
  Diff,
  Review,
  ReviewPullRequestInput,
  ReviewPullRequestOptions,
} from "@sovri/review-engine";

export type PullRequestWebhookContext = {
  readonly id: string;
  readonly name: string;
  readonly octokit: PullRequestOctokit;
  readonly payload: {
    readonly action: string;
    readonly pull_request: PullRequestPayload;
    readonly repository: {
      readonly full_name?: string;
    };
  };
};

export type PullRequestOctokit = {
  readonly request: <TData>(
    route: string,
    parameters: PullRequestDiffParameters,
  ) => Promise<{ readonly data: TData }>;
  readonly rest: {
    readonly issues: {
      readonly createComment: (parameters: IssueCommentParameters) => Promise<unknown>;
    };
    readonly pulls: {
      readonly createReview: (parameters: PullRequestReviewParameters) => Promise<unknown>;
    };
  };
};

type PullRequestDiffParameters = {
  readonly mediaType: {
    readonly format: "diff";
  };
  readonly owner: string;
  readonly pull_number: number;
  readonly repo: string;
};

type IssueCommentParameters = {
  readonly body: string;
  readonly issue_number: number;
  readonly owner: string;
  readonly repo: string;
};

type PullRequestReviewParameters = {
  readonly body: string;
  readonly commit_id: string;
  readonly event: "COMMENT";
  readonly owner: string;
  readonly pull_number: number;
  readonly repo: string;
};

export type ReviewPostTarget = {
  readonly commitSha: string;
  readonly number: number;
  readonly repoFullName: string;
};

export type PullRequestHandlerLogger = {
  error(message: string): void;
  error(bindings: Readonly<Record<string, unknown>>, message: string): void;
  info(message: string): void;
  info(bindings: Readonly<Record<string, unknown>>, message: string): void;
};

export type PullRequestHandlerDependencies = {
  readonly fetchDiff: (target: ReviewPostTarget) => Promise<Diff>;
  readonly loadConfig: (target: ReviewPostTarget) => Promise<SovriConfig>;
  readonly logger: PullRequestHandlerLogger;
  readonly postErrorComment: (target: ReviewPostTarget, message: string) => Promise<void>;
  readonly postReview: (target: ReviewPostTarget, review: Review) => Promise<void>;
  readonly reviewPullRequest: (
    input: ReviewPullRequestInput,
    options: ReviewPullRequestOptions,
  ) => Promise<Review>;
  readonly buildReviewOptions?: (config: SovriConfig) => ReviewPullRequestOptions;
  readonly reviewOptions?: ReviewPullRequestOptions;
};

type PullRequestPayload = {
  readonly additions?: number;
  readonly base?: {
    readonly ref?: string;
    readonly sha?: string;
  };
  readonly body?: string | null;
  readonly changed_files?: number;
  readonly deletions?: number;
  readonly draft?: boolean;
  readonly head?: {
    readonly ref?: string;
    readonly sha?: string;
  };
  readonly number?: number;
  readonly title?: string;
  readonly user?: {
    readonly login?: string;
  } | null;
};

const DefaultReviewOptions: ReviewPullRequestOptions = {
  provider: {
    maxTokens: 1,
    model: "unconfigured",
    name: "unconfigured",
    async generateStructured<T>(): Promise<T> {
      throw new PullRequestHandlerDependencyError("LLM provider is not configured");
    },
  },
};

class PullRequestHandlerDependencyError extends Error {
  public override readonly name = "PullRequestHandlerDependencyError";
}

export async function handlePullRequestOpened(
  context: PullRequestWebhookContext,
  dependencies: PullRequestHandlerDependencies,
): Promise<void> {
  await handlePullRequest(context, dependencies);
}

export async function handlePullRequestSynchronize(
  context: PullRequestWebhookContext,
  dependencies: PullRequestHandlerDependencies,
): Promise<void> {
  await handlePullRequest(context, dependencies);
}

async function handlePullRequest(
  context: PullRequestWebhookContext,
  dependencies: PullRequestHandlerDependencies,
): Promise<void> {
  const target = buildTarget(context);
  const logContext = buildLogContext(context, target);
  dependencies.logger.info(logContext, "Pull request review started");

  try {
    const config = await dependencies.loadConfig(target);
    if ((context.payload.pull_request.draft ?? false) && !config.review.autoReviewDrafts) {
      dependencies.logger.info(
        {
          ...logContext,
          draft: true,
        },
        "Pull request review skipped",
      );
      return;
    }

    const diff = await dependencies.fetchDiff(target);
    const reviewOptions =
      dependencies.buildReviewOptions?.(config) ??
      dependencies.reviewOptions ??
      DefaultReviewOptions;
    const review = await dependencies.reviewPullRequest(
      {
        config,
        diff,
        pullRequest: buildPullRequest(context),
      },
      reviewOptions,
    );
    await dependencies.postReview(target, review);
    dependencies.logger.info(
      {
        ...logContext,
        result: review.status,
      },
      "Pull request review completed",
    );
  } catch (error) {
    await reportReviewFailure({
      dependencies,
      error,
      logContext,
      target,
    });
  }
}

function buildTarget(context: PullRequestWebhookContext): ReviewPostTarget {
  const pullRequest = context.payload.pull_request;
  return {
    commitSha: requireString(pullRequest.head?.sha, "pull_request.head.sha"),
    number: requireNumber(pullRequest.number, "pull_request.number"),
    repoFullName: requireString(context.payload.repository.full_name, "repository.full_name"),
  };
}

function buildPullRequest(
  context: PullRequestWebhookContext,
): ReviewPullRequestInput["pullRequest"] {
  const pullRequest = context.payload.pull_request;
  return {
    additions: requireNumber(pullRequest.additions, "pull_request.additions"),
    author: requireString(pullRequest.user?.login, "pull_request.user.login"),
    base_ref: requireString(pullRequest.base?.ref, "pull_request.base.ref"),
    base_sha: requireString(pullRequest.base?.sha, "pull_request.base.sha"),
    body: pullRequest.body ?? null,
    changed_files: requireNumber(pullRequest.changed_files, "pull_request.changed_files"),
    deletions: requireNumber(pullRequest.deletions, "pull_request.deletions"),
    draft: pullRequest.draft ?? false,
    head_ref: requireString(pullRequest.head?.ref, "pull_request.head.ref"),
    head_sha: requireString(pullRequest.head?.sha, "pull_request.head.sha"),
    number: requireNumber(pullRequest.number, "pull_request.number"),
    repo_full_name: requireString(context.payload.repository.full_name, "repository.full_name"),
    title: requireString(pullRequest.title, "pull_request.title"),
  };
}

function buildLogContext(
  context: PullRequestWebhookContext,
  target: ReviewPostTarget,
): Readonly<Record<string, unknown>> {
  return {
    delivery_id: context.id,
    event: context.name,
    pr_number: target.number,
    repo: target.repoFullName,
  };
}

async function reportReviewFailure(values: {
  readonly dependencies: PullRequestHandlerDependencies;
  readonly error: unknown;
  readonly logContext: Readonly<Record<string, unknown>>;
  readonly target: ReviewPostTarget;
}): Promise<void> {
  const errorMessage = errorMessageFrom(values.error);
  const commentErrorMessage = await tryPostFailureComment(values.dependencies, values.target);

  values.dependencies.logger.error(
    {
      ...values.logContext,
      comment_error_message: commentErrorMessage,
      error_message: errorMessage,
    },
    "Pull request review failed",
  );
}

async function tryPostFailureComment(
  dependencies: PullRequestHandlerDependencies,
  target: ReviewPostTarget,
): Promise<string | undefined> {
  try {
    await dependencies.postErrorComment(target, "review failed");
    return undefined;
  } catch (error) {
    return errorMessageFrom(error);
  }
}

function errorMessageFrom(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "unknown review failure";
}

function requireString(value: string | undefined, field: string): string {
  if (value === undefined || value.length === 0) {
    throw new PullRequestHandlerDependencyError(`${field} is required`);
  }

  return value;
}

function requireNumber(value: number | undefined, field: string): number {
  if (value === undefined) {
    throw new PullRequestHandlerDependencyError(`${field} is required`);
  }

  return value;
}
