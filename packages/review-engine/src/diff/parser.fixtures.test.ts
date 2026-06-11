// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri contributors

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { DiffSchema } from "@sovri/core";
import { describe, expect, it } from "vitest";

import { parseUnifiedDiff } from "./parser.js";

const packageRoot = fileURLToPath(new URL("../../", import.meta.url));
const fixturesRoot = join(packageRoot, "test-fixtures", "diffs");
const requiredFixtures = ["simple-add", "multi-file", "rename", "binary", "empty"] as const;

describe("real diff fixtures", () => {
  it.each(requiredFixtures)("parses the required %s fixture successfully", (fixture) => {
    const path = join(fixturesRoot, `${fixture}.diff`);

    // Given the fixture file exists.
    expect(existsSync(path), `missing fixture ${fixture}.diff`).toBe(true);

    // When the maintainer parses the fixture with `parseUnifiedDiff`.
    const diff = parseUnifiedDiff(readFileSync(path, "utf8"));

    // Then parsing succeeds and validates against `DiffSchema`.
    expect(DiffSchema.parse(diff)).toEqual(diff);
    expectFixtureBehavior(fixture, diff);
  });

  it("fails the parser test suite when a required fixture is missing", () => {
    // Given every required fixture must be present on disk.
    const observedFixtures = new Set(
      requiredFixtures.filter((fixture) => existsSync(join(fixturesRoot, `${fixture}.diff`))),
    );

    // When the maintainer checks fixture coverage.
    const missingFixtures = requiredFixtures
      .filter((fixture) => !observedFixtures.has(fixture))
      .map((fixture) => `${fixture}.diff`);

    // Then no required fixture is absent, regardless of which.
    expect(missingFixtures, `missing fixtures: ${missingFixtures.join(", ")}`).toEqual([]);
  });

  it("returns an empty valid Diff for an empty fixture", () => {
    const raw = readFileSync(join(fixturesRoot, "empty.diff"), "utf8");

    // Given the empty fixture contains an empty string.
    // When the maintainer parses the fixture with `parseUnifiedDiff`.
    const diff = parseUnifiedDiff(raw);

    // Then the parser returns an empty but schema-valid Diff.
    expect(diff.unified_diff).toBe("");
    expect(diff.files).toEqual([]);
    expect(DiffSchema.parse(diff)).toEqual(diff);
  });
});

function expectFixtureBehavior(fixture: (typeof requiredFixtures)[number], diff: unknown): void {
  const parsed = DiffSchema.parse(diff);
  if (fixture === "simple-add") {
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0]).toMatchObject({ path: "src/new.ts", status: "added" });
    expect(parsed.files[0]?.hunks).toHaveLength(1);
  } else if (fixture === "multi-file") {
    expect(parsed.files).toHaveLength(2);
  } else if (fixture === "rename") {
    expect(parsed.files[0]).toMatchObject({
      path: "src/new-name.ts",
      previous_path: "src/old-name.ts",
      status: "renamed",
    });
  } else if (fixture === "binary") {
    expect(parsed.files[0]).toMatchObject({ path: "assets/logo.png", patch: null });
  } else {
    expect(parsed.files).toEqual([]);
  }
}
