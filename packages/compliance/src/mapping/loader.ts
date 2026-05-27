// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { ComplianceMappingEntrySchema, type ComplianceMappingEntry } from "./schema.js";
import cwe798Entry from "./data/CWE-798.json" with { type: "json" };

const mappingEntries = [cwe798Entry] satisfies readonly unknown[];
const cweMap = buildCweMap(mappingEntries);

function buildCweMap(entries: readonly unknown[]): ReadonlyMap<string, ComplianceMappingEntry> {
  const parsedEntries = entries.map((entry) => ComplianceMappingEntrySchema.parse(entry));

  return new Map(parsedEntries.map((entry) => [entry.cwe_id, entry]));
}

export function getCweMap(): ReadonlyMap<string, ComplianceMappingEntry> {
  return cweMap;
}
