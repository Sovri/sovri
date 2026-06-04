// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { describe, expect, it } from "vitest";

import { scanSyntaxFragment } from "./syntax-scanner.js";

describe("scanSyntaxFragment", () => {
  it("stops after a balanced JSX attribute expression", () => {
    const code = "{format(enabled ? primary : fallback)} disabled";

    const result = scanSyntaxFragment(code, 0, {
      rejectEmptyInitialDelimiter: true,
      stopAfterBalancedDelimiter: true,
    });

    expect(result).toEqual({
      sane: true,
      skip: "{format(enabled ? primary : fallback)}".length - 1,
    });
  });

  it("rejects an empty initial JSX attribute expression", () => {
    const result = scanSyntaxFragment("{ }", 0, {
      rejectEmptyInitialDelimiter: true,
      stopAfterBalancedDelimiter: true,
    });

    expect(result).toEqual({ sane: false, skip: 2 });
  });
});
