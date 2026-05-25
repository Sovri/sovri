// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { describe, expect, it, vi } from "vitest";

import { DEFAULT_CONFIG } from "@sovri/config";
import type { Diff, Review } from "@sovri/review-engine";

import {
  handleReReviewCommand,
  type ReReviewCommandDependencies,
  type ReReviewOctokit,
} from "../../../src/commands/handlers/re-review.js";
import type { IssueCommentCommandContext } from "../../../src/handlers/issue-comment.js";
import type { PullRequestHandlerDependencies } from "../../../src/handlers/pull-request.js";

const RepoFullName = "mpiton/sovri";
const DeliveryId = "delivery-re-review-lookup-failure";
const PullRequestNumber = 42;
const CommentId = 87654;
const BaseSha = "dddddddddddddddddddddddddddddddddddddddd";
const HeadSha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("re-review command handler", () => {
  it.each([
    { failure: "GitHub lookup", mode: "rejects" },
    { failure: "pull request schema validation", mode: "invalid-response" },
  ])("posts one review failure comment for $failure failure", async ({ mode }) => {
    const runtime = buildRuntime(mode);

    await handleReReviewCommand(buildCommand(), runtime.dependencies);

    expect(runtime.octokit.rest.pulls.get).toHaveBeenCalledWith({
      owner: "mpiton",
      pull_number: PullRequestNumber,
      repo: "sovri",
    });
    expect(runtime.createPullRequestDependencies).toHaveBeenCalledTimes(1);
    expect(runtime.postErrorComment).toHaveBeenCalledWith(
      { number: PullRequestNumber, repoFullName: RepoFullName },
      "review failed",
    );
    expect(runtime.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        delivery_id: DeliveryId,
        event: "pull_request.synchronize",
        pr_number: PullRequestNumber,
        repo: RepoFullName,
      }),
      "Pull request review failed",
    );
    expect(runtime.loadConfig).not.toHaveBeenCalled();
    expect(runtime.fetchDiff).not.toHaveBeenCalled();
    expect(runtime.reviewPullRequest).not.toHaveBeenCalled();
    expect(runtime.postReview).not.toHaveBeenCalled();
  });

  it("delegates successful pull request resolution to the synchronize handler", async () => {
    const runtime = buildRuntime("valid-response");

    await handleReReviewCommand(buildCommand(), runtime.dependencies);

    expect(runtime.loadConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        baseSha: BaseSha,
        commitSha: HeadSha,
        number: PullRequestNumber,
        repoFullName: RepoFullName,
      }),
    );
    expect(runtime.fetchDiff).toHaveBeenCalledTimes(1);
    expect(runtime.reviewPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        pullRequest: expect.objectContaining({
          head_sha: HeadSha,
          number: PullRequestNumber,
          repo_full_name: RepoFullName,
        }),
      }),
      expect.any(Object),
    );
    expect(runtime.postReview).toHaveBeenCalledTimes(1);
    expect(runtime.postErrorComment).not.toHaveBeenCalled();
  });
});

type RuntimeMode = "invalid-response" | "rejects" | "valid-response";

function buildRuntime(mode: RuntimeMode): {
  readonly createPullRequestDependencies: ReturnType<
    typeof vi.fn<ReReviewCommandDependencies["createPullRequestDependencies"]>
  >;
  readonly dependencies: ReReviewCommandDependencies;
  readonly fetchDiff: ReturnType<typeof vi.fn<PullRequestHandlerDependencies["fetchDiff"]>>;
  readonly loadConfig: ReturnType<typeof vi.fn<PullRequestHandlerDependencies["loadConfig"]>>;
  readonly logger: PullRequestHandlerDependencies["logger"];
  readonly octokit: ReReviewOctokit;
  readonly postErrorComment: ReturnType<
    typeof vi.fn<PullRequestHandlerDependencies["postErrorComment"]>
  >;
  readonly postReview: ReturnType<typeof vi.fn<PullRequestHandlerDependencies["postReview"]>>;
  readonly reviewPullRequest: ReturnType<
    typeof vi.fn<PullRequestHandlerDependencies["reviewPullRequest"]>
  >;
} {
  const octokit = buildOctokit(mode);
  const fetchDiff = vi.fn<PullRequestHandlerDependencies["fetchDiff"]>(async () => buildDiff());
  const loadConfig = vi.fn<PullRequestHandlerDependencies["loadConfig"]>(
    async () => DEFAULT_CONFIG,
  );
  const postErrorComment = vi.fn<PullRequestHandlerDependencies["postErrorComment"]>(
    async () => undefined,
  );
  const postReview = vi.fn<PullRequestHandlerDependencies["postReview"]>(async () => undefined);
  const reviewPullRequest = vi.fn<PullRequestHandlerDependencies["reviewPullRequest"]>(async () =>
    buildReview(),
  );
  const logger: PullRequestHandlerDependencies["logger"] = {
    error: vi.fn<PullRequestHandlerDependencies["logger"]["error"]>(() => undefined),
    info: vi.fn<PullRequestHandlerDependencies["logger"]["info"]>(() => undefined),
  };
  const pullRequestDependencies: PullRequestHandlerDependencies = {
    fetchDiff,
    loadConfig,
    logger,
    postErrorComment,
    postReview,
    reviewPullRequest,
  };
  const createPullRequestDependencies = vi.fn<
    ReReviewCommandDependencies["createPullRequestDependencies"]
  >(() => pullRequestDependencies);

  return {
    createPullRequestDependencies,
    dependencies: {
      createPullRequestDependencies,
      octokit,
    },
    fetchDiff,
    loadConfig,
    logger,
    octokit,
    postErrorComment,
    postReview,
    reviewPullRequest,
  };
}

function buildOctokit(mode: RuntimeMode): ReReviewOctokit {
  const getPullRequest = vi.fn<ReReviewOctokit["rest"]["pulls"]["get"]>(async () => {
    if (mode === "rejects") {
      throw new Error("GitHub pull lookup failed");
    }

    return {
      data: mode === "invalid-response" ? { number: PullRequestNumber } : buildPullRequest(),
    };
  });

  return {
    async request() {
      return { data: "" };
    },
    rest: {
      issues: {
        async createComment(parameters) {
          return { data: { body: parameters.body, id: CommentId } };
        },
        async deleteComment() {
          return { data: {} };
        },
        async listComments() {
          return { data: [] };
        },
        async updateComment(parameters) {
          return { data: { body: parameters.body, id: parameters.comment_id } };
        },
      },
      pulls: {
        async createReview(parameters) {
          return { data: { body: parameters.body, id: 98765 } };
        },
        async createReviewComment() {
          return { data: { id: 98766 } };
        },
        get: getPullRequest,
        async listFiles() {
          return { data: [] };
        },
        async listReviews() {
          return { data: [] };
        },
        async updateReview(parameters) {
          return { data: { body: parameters.body, id: parameters.review_id } };
        },
      },
      repos: {
        async getContent() {
          return { data: "" };
        },
      },
    },
  };
}

function buildCommand(): IssueCommentCommandContext {
  return {
    commentId: CommentId,
    correlationId: DeliveryId,
    issueNumber: PullRequestNumber,
    pullRequestNumber: PullRequestNumber,
    repoFullName: RepoFullName,
  };
}

function buildPullRequest() {
  return {
    additions: 12,
    base: {
      ref: "main",
      sha: BaseSha,
    },
    body: "Implement re-review.",
    changed_files: 1,
    deletions: 3,
    draft: false,
    head: {
      ref: "task-77",
      sha: HeadSha,
    },
    number: PullRequestNumber,
    title: "Implement re-review",
    user: {
      login: "octocat",
    },
  };
}

function buildDiff(): Diff {
  return {
    files: [],
    unified_diff: "",
  };
}

function buildReview(): Review {
  return {
    completed_at: new Date("2026-05-18T10:00:01.000Z"),
    commit_sha: HeadSha,
    findings: [],
    id: "123e4567-e89b-42d3-a456-426614174001",
    llm_model: "test-model",
    llm_provider: "test-provider",
    pr_number: PullRequestNumber,
    repo_full_name: RepoFullName,
    started_at: new Date("2026-05-18T10:00:00.000Z"),
    status: "success",
    summary: "Review complete",
    tokens_used: {
      completion: 20,
      prompt: 100,
    },
    walkthrough_markdown: "Review complete",
  };
}
