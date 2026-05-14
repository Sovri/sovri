// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { describe, expect, it } from "vitest";

import {
  DiffSchema,
  FileChangeSchema,
  FileChangeStatusSchema,
  PullRequestSchema,
  ReviewSchema,
  z,
} from "./index.js";

describe("@sovri/core", () => {
  it("exposes a functional zod instance", () => {
    expect(typeof z).toBe("object");
    expect(typeof z.string).toBe("function");
  });

  it("exports ReviewSchema from the package barrel", () => {
    expect(typeof ReviewSchema.parse).toBe("function");
  });

  it("exports PullRequestSchema from the package barrel", () => {
    expect(typeof PullRequestSchema.parse).toBe("function");
  });

  it("exports DiffSchema from the package barrel", () => {
    expect(typeof DiffSchema.parse).toBe("function");
  });

  it("exports FileChangeSchema from the package barrel", () => {
    expect(typeof FileChangeSchema.parse).toBe("function");
  });

  it("exports FileChangeStatusSchema from the package barrel", () => {
    expect(typeof FileChangeStatusSchema.parse).toBe("function");
  });
});
