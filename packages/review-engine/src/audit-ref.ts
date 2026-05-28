// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { randomBytes } from "node:crypto";
import type { Category } from "@sovri/core";

const CATEGORY_CODES: Record<Category, string> = {
  bug: "BG",
  security: "SC",
  performance: "PF",
  maintainability: "MT",
  style: "ST",
  documentation: "DC",
  "test-coverage": "TC",
};

const hexSegment = (): string => randomBytes(2).toString("hex").toUpperCase();

/**
 * Generate a human-readable audit reference of the form `SOVRI-XX-HHHH-HHHH`,
 * where `XX` is the fixed two-letter code for the finding category and each
 * `HHHH` segment is four uppercase hex chars from two random bytes.
 */
export function generateAuditReference(category: Category): string {
  return `SOVRI-${CATEGORY_CODES[category]}-${hexSegment()}-${hexSegment()}`;
}
