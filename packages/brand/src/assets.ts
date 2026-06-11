// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri contributors

import { z } from "zod";

// Absolute URLs for the brand banners embedded in GitHub PR review comments.
// GitHub renders a Markdown image in a comment body by proxying it through
// camo.githubusercontent.com, so a repo-relative path (which resolves in the
// rendered README) does NOT resolve inside a comment: the review header/footer
// must reference the raw asset by absolute URL. The banners live under the
// published Apache-2.0 `assets/` directory and are pinned to the default branch.
const AssetBaseUrl = "https://raw.githubusercontent.com/mpiton/sovri/main/assets";

export const BrandAssetUrlsSchema = z.strictObject({
  reviewCommentHeader: z.string().startsWith("https://"),
  reviewCommentFooter: z.string().startsWith("https://"),
});
export type BrandAssetUrls = z.infer<typeof BrandAssetUrlsSchema>;

export const brandAssetUrls: BrandAssetUrls = Object.freeze({
  reviewCommentHeader: `${AssetBaseUrl}/review-comment-header.png`,
  reviewCommentFooter: `${AssetBaseUrl}/review-comment-footer.png`,
});

// Validate at module load so a malformed URL fails fast at import, mirroring the
// token exports.
BrandAssetUrlsSchema.parse(brandAssetUrls);
