// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri contributors

/**
 * Deterministic CWE derivation from a finding's own signals (ADR-020).
 *
 * When the model omits the CWE, recover a single mapped CWE from the finding's
 * title and body text — offline, with no second LLM call. Precision over
 * recall: a rule fires only on an unambiguous vulnerability-class signal, and
 * when zero or more than one rule matches, derivation declines (`undefined`).
 * The caller maps the returned id through the same static CWE map as a
 * model-supplied CWE, so a derived id absent from the map yields no reference.
 */

export interface DerivableSignals {
  readonly title: string;
  readonly body: string;
}

interface DerivationRule {
  readonly cwe: string;
  readonly matches: (text: string) => boolean;
}

// Each rule requires a vulnerability-class keyword plus a corroborating signal,
// so generic phrasing ("possible security concern") never derives a CWE.
const DERIVATION_RULES: readonly DerivationRule[] = [
  {
    // CWE-89 SQL Injection: a SQL query assembled by string concatenation or interpolation.
    cwe: "CWE-89",
    matches: (text) =>
      /\bsql\b/u.test(text) &&
      /(string concatenation|concatenat|interpolat|string building)/u.test(text),
  },
  {
    // CWE-79 Cross-site Scripting: unescaped user input rendered into HTML/markup.
    cwe: "CWE-79",
    matches: (text) =>
      /(unescaped|not escaped|without escaping)/u.test(text) && /(html|markup|dom)/u.test(text),
  },
];

/**
 * Derive a single mapped CWE id from a finding's signals, or `undefined` when
 * the content maps to no rule or to more than one (ambiguous — decline).
 */
export function deriveCwe(signals: DerivableSignals): string | undefined {
  const text = `${signals.title}\n${signals.body}`.toLowerCase();
  const matched = DERIVATION_RULES.filter((rule) => rule.matches(text));
  if (matched.length !== 1) {
    return undefined;
  }

  const [rule] = matched;

  return rule?.cwe;
}
