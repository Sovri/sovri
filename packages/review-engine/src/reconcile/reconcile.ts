// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import type { Diff, Finding } from "@sovri/core";

import { computeFindingFingerprint } from "./fingerprint.js";

/**
 * Reconcile freshly-computed findings against the fingerprints already posted by
 * the bot on the pull request: drop findings whose fingerprint is already
 * posted, and collapse duplicates produced within this run (first wins). Pure —
 * the caller supplies the posted-fingerprint set; this performs no I/O.
 */
export function reconcileFindings(
  findings: readonly Finding[],
  diff: Diff,
  postedFingerprints: ReadonlySet<string>,
): Finding[] {
  const kept: Finding[] = [];
  const seen = new Set<string>();

  for (const finding of findings) {
    const fingerprint = computeFindingFingerprint(finding, diff);
    if (postedFingerprints.has(fingerprint) || seen.has(fingerprint)) {
      continue;
    }
    seen.add(fingerprint);
    kept.push(finding);
  }

  return kept;
}
