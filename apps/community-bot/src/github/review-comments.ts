// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri contributors

import { z } from "@sovri/core";

import { FindingMarkerPattern, type RepoRef } from "../commands/shared-utilities.js";

const REVIEW_COMMENT_PAGE_SIZE = 100;

const PullRequestAuthorSchema = z
  .object({
    user: z
      .object({
        login: z.string().min(1),
      })
      .nullable(),
  })
  .passthrough();

export type PullRequestReviewComment = {
  readonly body?: string | null;
  readonly id: number;
  readonly node_id?: string;
  readonly user?: {
    readonly login?: string;
  } | null;
};

type PullRequestReviewCommentListParameters = {
  readonly owner: string;
  readonly page?: number;
  readonly per_page?: number;
  readonly pull_number: number;
  readonly repo: string;
};

type PullRequestGetParameters = {
  readonly owner: string;
  readonly pull_number: number;
  readonly repo: string;
};

type ReviewCommentListOctokit = {
  readonly rest: {
    readonly pulls: {
      readonly listReviewComments: (
        parameters: PullRequestReviewCommentListParameters,
      ) => Promise<{ readonly data: readonly PullRequestReviewComment[] }>;
    };
  };
};

type PullRequestGetOctokit = {
  readonly rest: {
    readonly pulls: {
      readonly get: (parameters: PullRequestGetParameters) => Promise<{ readonly data: unknown }>;
    };
  };
};

/**
 * List every review comment on a pull request, walking all pages. Returns the
 * raw set; callers apply their own bot-login / finding-marker filtering.
 */
export async function listReviewCommentsOnAllPages(
  octokit: ReviewCommentListOctokit,
  repo: RepoRef,
  pullRequestNumber: number,
): Promise<PullRequestReviewComment[]> {
  return listReviewCommentsPage(octokit, repo, pullRequestNumber, 1);
}

async function listReviewCommentsPage(
  octokit: ReviewCommentListOctokit,
  repo: RepoRef,
  pullRequestNumber: number,
  page: number,
): Promise<PullRequestReviewComment[]> {
  const comments = await octokit.rest.pulls.listReviewComments({
    owner: repo.owner,
    page,
    per_page: REVIEW_COMMENT_PAGE_SIZE,
    pull_number: pullRequestNumber,
    repo: repo.repo,
  });
  if (comments.data.length < REVIEW_COMMENT_PAGE_SIZE) {
    return [...comments.data];
  }

  return [
    ...comments.data,
    ...(await listReviewCommentsPage(octokit, repo, pullRequestNumber, page + 1)),
  ];
}

/** Match a review comment against a finding id via its embedded marker. */
export function hasFindingMarker(comment: PullRequestReviewComment, findingId: string): boolean {
  return extractFindingId(comment.body) === findingId;
}

/** Read the finding id embedded in a comment/line body, if any. */
export function extractFindingId(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  return FindingMarkerPattern.exec(value)?.[1];
}

/**
 * Resolve the login of a pull request's author. Throws via the supplied
 * `createError` factory when the author is missing, so each caller keeps its
 * own typed adapter error.
 */
export async function resolvePullRequestAuthorLogin(
  octokit: PullRequestGetOctokit,
  repo: RepoRef,
  pullRequestNumber: number,
  createError: (message: string) => Error,
): Promise<string> {
  const response = await octokit.rest.pulls.get({
    owner: repo.owner,
    pull_number: pullRequestNumber,
    repo: repo.repo,
  });
  const pullRequest = PullRequestAuthorSchema.parse(response.data);
  if (pullRequest.user === null) {
    throw createError("Pull request author is missing");
  }

  return pullRequest.user.login;
}
