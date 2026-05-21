// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

export type VitestApiStyleFile = {
  readonly path: string;
  readonly source: string;
};

export type VitestApiStyleEvaluation = {
  readonly messages: readonly string[];
  readonly passed: boolean;
};

export type VitestApiStyleInput = {
  readonly configSource: string;
  readonly files: readonly VitestApiStyleFile[];
};

export function evaluateVitestApiStyle(input: VitestApiStyleInput): VitestApiStyleEvaluation {
  void input;

  return {
    messages: [],
    passed: true,
  };
}
