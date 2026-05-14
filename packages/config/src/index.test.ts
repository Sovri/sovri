// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { describe, expect, expectTypeOf, it } from "vitest";

import type { Severity as CoreSeverity } from "@sovri/core";
import type { Logger as ObservabilityLogger } from "@sovri/observability";

import { SovriConfigSchema, type Logger, type Severity } from "./index.js";

describe("@sovri/config barrel", () => {
  it("scaffold schema accepts an empty object", () => {
    expect(SovriConfigSchema.parse({})).toEqual({});
  });

  it("scaffold schema preserves unknown keys (passthrough)", () => {
    expect(SovriConfigSchema.parse({ foo: 1, bar: "x" })).toEqual({ foo: 1, bar: "x" });
  });

  it("scaffold schema rejects non-object input", () => {
    expect(SovriConfigSchema.safeParse(null).success).toBe(false);
    expect(SovriConfigSchema.safeParse("string").success).toBe(false);
    expect(SovriConfigSchema.safeParse(42).success).toBe(false);
  });

  it("Severity re-export matches @sovri/core", () => {
    expectTypeOf<Severity>().toEqualTypeOf<CoreSeverity>();
  });

  it("Logger re-export matches @sovri/observability", () => {
    expectTypeOf<Logger>().toEqualTypeOf<ObservabilityLogger>();
  });
});
