// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { describe, expect, it } from "vitest";

import { BrandAssetUrlsSchema, brandAssetUrls } from "./assets.js";

describe("brandAssetUrls", () => {
  it("exposes absolute https URLs for the review comment banners", () => {
    expect(brandAssetUrls.reviewCommentHeader).toMatch(/^https:\/\//u);
    expect(brandAssetUrls.reviewCommentFooter).toMatch(/^https:\/\//u);
  });

  it("points at the published assets directory for header and footer", () => {
    expect(brandAssetUrls.reviewCommentHeader).toContain("/assets/review-comment-header.png");
    expect(brandAssetUrls.reviewCommentFooter).toContain("/assets/review-comment-footer.png");
  });

  it("validates against its schema", () => {
    expect(() => BrandAssetUrlsSchema.parse(brandAssetUrls)).not.toThrow();
  });

  it("rejects a relative path that would not resolve inside a GitHub comment", () => {
    expect(() =>
      BrandAssetUrlsSchema.parse({
        reviewCommentHeader: "assets/review-comment-header.png",
        reviewCommentFooter: "assets/review-comment-footer.png",
      }),
    ).toThrow();
  });
});
