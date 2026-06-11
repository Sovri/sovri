// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri contributors

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

  it("rejects a URL without the required https:// scheme", () => {
    // The schema guards the invariant that both banners are absolute https URLs. A relative
    // path is one way to violate it; the rejection is about the scheme the schema enforces,
    // not about how GitHub happens to render a relative path today.
    expect(() =>
      BrandAssetUrlsSchema.parse({
        reviewCommentHeader: "assets/review-comment-header.png",
        reviewCommentFooter: "assets/review-comment-footer.png",
      }),
    ).toThrow();
  });
});
