// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri contributors

import type { Finding } from "@sovri/core";

import { deriveCwe } from "./derive.js";
import { getCweMap } from "./loader.js";

/**
 * Populate a finding's compliance_references from the static CWE map.
 *
 * Pure and deterministic: the result depends only on the finding and the
 * in-memory map. references are recomputed on every call (overwrite), so a
 * finding whose cwe no longer resolves is cleared to an empty array.
 *
 * When the model omitted the cwe, a single mapped cwe is derived from the
 * finding's own signals (ADR-020) — offline, no second LLM call. A
 * model-supplied cwe is used as-is and never overridden by derivation.
 */
export function enrichFindingCompliance(finding: Finding): Finding {
  const cwe = finding.cwe ?? deriveCwe(finding);
  if (cwe === undefined) {
    return { ...finding, compliance_references: [] };
  }

  const entry = getCweMap().get(cwe);
  if (entry === undefined) {
    return { ...finding, compliance_references: [] };
  }

  return { ...finding, compliance_references: [...entry.references] };
}
