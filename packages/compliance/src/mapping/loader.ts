// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { ComplianceMappingEntrySchema, type ComplianceMappingEntry } from "./schema.js";

const mappingEntries = [] satisfies readonly unknown[];
const cweMap = buildCweMap(mappingEntries);

function buildCweMap(entries: readonly unknown[]): ReadonlyMap<string, ComplianceMappingEntry> {
  const parsedEntries = entries.map((entry) => ComplianceMappingEntrySchema.parse(entry));

  return new Map(parsedEntries.map((entry) => [entry.cwe_id, entry]));
}

export function getCweMap(): ReadonlyMap<string, ComplianceMappingEntry> {
  return cweMap;
}
