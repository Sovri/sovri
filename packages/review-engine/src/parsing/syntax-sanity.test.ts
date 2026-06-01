// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { describe, expect, it } from "vitest";

type SyntaxSanityModule = {
  readonly isSyntacticallySane: (code: string) => boolean;
};

describe("isSyntacticallySane", () => {
  it("validates balanced snippets and rejects uncertain syntax conservatively", async () => {
    // Given the syntactic sanity helper is invoked directly from the parsing layer
    const { isSyntacticallySane } = await loadSyntaxSanityHelper();

    const saneCodes = [
      "return calculateTotal(items);",
      "const tuple = [first, { second: true }];",
      'const label = "ready";',
      "const label = `ready`;",
      "const label = 'ready';",
    ];

    for (const code of saneCodes) {
      // Given the candidate suggestion code is <code>
      // When the syntactic sanity helper validates the code
      const result = isSyntacticallySane(code);

      // Then the result is true
      expect(result).toBe(true);
    }

    const uncertainCodes = [
      "return calculateTotal(items;",
      "return calculateTotal(items));",
      "const tuple = [first, second);",
      'const object = { name: "Ada";',
      'const label = "ready;',
      "const label = `ready;",
      "return normalize(value...",
    ];

    for (const code of uncertainCodes) {
      // Given the candidate suggestion code is <code>
      // When the syntactic sanity helper validates the code
      const result = isSyntacticallySane(code);

      // Then the result is false
      expect(result).toBe(false);
    }

    // Given the candidate suggestion code is "const message = \"Total (estimated\";"
    const balancedMessage = 'const message = "Total (estimated";';

    // When the syntactic sanity helper validates the code
    const balancedResult = isSyntacticallySane(balancedMessage);

    // Then the result is true
    expect(balancedResult).toBe(true);

    // When the candidate suggestion code is "const message = \"Total (estimated\";"
    // And the final semicolon is replaced by ")"
    const uncertainMessage = 'const message = "Total (estimated")';
    const uncertainResult = isSyntacticallySane(uncertainMessage);

    // Then the syntactic sanity helper result is false
    expect(uncertainResult).toBe(false);
  });
});

async function loadSyntaxSanityHelper(): Promise<SyntaxSanityModule> {
  const modulePath = ["./syntax-sanity", "js"].join(".");
  const module: unknown = await import(modulePath);

  if (!isSyntaxSanityModule(module)) {
    throw new TypeError("Syntax sanity helper module has an invalid shape");
  }

  return module;
}

function isSyntaxSanityModule(module: unknown): module is SyntaxSanityModule {
  if (typeof module !== "object" || module === null) {
    return false;
  }

  return typeof Reflect.get(module, "isSyntacticallySane") === "function";
}
