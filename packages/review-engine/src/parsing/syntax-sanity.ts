// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri contributors

import { scanSyntaxFragment } from "./syntax-scanner.js";

export function isSyntacticallySane(code: string): boolean {
  return scanSyntaxFragment(code).sane;
}
