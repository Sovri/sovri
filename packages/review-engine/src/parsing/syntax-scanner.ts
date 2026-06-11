// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri contributors

import {
  ClosingDelimiters,
  OpeningDelimiters,
  QuoteCharacters,
  isDecimalDigit,
  isIdentifierStart,
  isTerminalOperatorToken,
  isWhitespace,
} from "./syntax-characters.js";
import { scanRegexFlags } from "./syntax-regex-flags.js";
import {
  canStartRegexLiteral,
  isCannotEndToken,
  isCannotPrecedeColonToken,
  isOperandToken,
  isPostfixUpdateOperator,
  isSupportedNumberLiteral,
  isUnexpectedAdjacentOperand,
  readIdentifier,
  readNumberLiteral,
  scanComparisonToken,
  significantIdentifierToken,
  startsRejectedAsciiEllipsis,
} from "./syntax-token-rules.js";

const StatementTerminatorAllowedPrefixKeywords = new Set<string>(["return", "yield"]);
const JsxContentToken = "jsx-content";

type QuotedScanResult = {
  readonly closed: boolean;
  readonly escaping: boolean;
  readonly opensTemplateExpression: boolean;
};

function scanQuotedCharacter(
  code: string,
  index: number,
  char: string,
  quote: string,
  escaping: boolean,
): QuotedScanResult {
  if (escaping) {
    return { closed: false, escaping: false, opensTemplateExpression: false };
  }
  if (char === "\\") {
    return { closed: false, escaping: true, opensTemplateExpression: false };
  }
  if (quote === "`" && char === "$" && code.charAt(index + 1) === "{") {
    return { closed: false, escaping: false, opensTemplateExpression: true };
  }
  return { closed: char === quote, escaping: false, opensTemplateExpression: false };
}

type RegexScanResult = {
  readonly closed: boolean;
  readonly escaping: boolean;
  readonly inRegexClass: boolean;
};

function scanRegexCharacter(
  char: string,
  escaping: boolean,
  inRegexClass: boolean,
): RegexScanResult {
  if (escaping) {
    return { closed: false, escaping: false, inRegexClass };
  }
  if (char === "\\") {
    return { closed: false, escaping: true, inRegexClass };
  }
  if (char === "[" && !inRegexClass) {
    return { closed: false, escaping: false, inRegexClass: true };
  }
  if (char === "]" && inRegexClass) {
    return { closed: false, escaping: false, inRegexClass: false };
  }
  return { closed: char === "/" && !inRegexClass, escaping: false, inRegexClass };
}

type NormalScanResult = {
  readonly sane: boolean;
  readonly stop?: boolean;
  readonly skip?: number;
  readonly quote?: string;
  readonly inBlockComment?: boolean;
  readonly inRegex?: boolean;
  readonly resumeTemplate?: boolean;
  readonly previousSignificant?: string;
  readonly opensTernary?: boolean;
  readonly closesTernary?: boolean;
};

type DelimiterStackEntry = {
  readonly closing: string;
  readonly resumesTemplate: boolean;
  readonly openedAfterOperand: boolean;
  readonly containsTernary: boolean;
  readonly resumesJsxContent: boolean;
};

export type SyntaxFragmentScanResult = {
  readonly sane: boolean;
  readonly skip: number;
};

type SyntaxFragmentScanOptions = {
  readonly stopAfterBalancedDelimiter?: boolean;
  readonly rejectEmptyInitialDelimiter?: boolean;
};

type NormalCharacterScanContext = {
  readonly code: string;
  readonly index: number;
  readonly char: string;
  readonly previousSignificant: string | undefined;
  readonly delimiterStack: DelimiterStackEntry[];
};

type NormalCharacterScanner = (context: NormalCharacterScanContext) => NormalScanResult | undefined;

function scanNormalCharacter(
  code: string,
  index: number,
  char: string,
  previousSignificant: string | undefined,
  delimiterStack: DelimiterStackEntry[],
): NormalScanResult {
  const context = { code, index, char, previousSignificant, delimiterStack };
  for (const scanner of NormalCharacterScanners) {
    const result = scanner(context);
    if (result !== undefined) {
      return result;
    }
  }
  return scanDelimiterOrToken(context);
}

const NormalCharacterScanners: readonly NormalCharacterScanner[] = [
  scanLineCommentToken,
  scanBlockCommentToken,
  scanJsxClosingToken,
  scanJsxOpeningToken,
  scanJsxTextToken,
  scanRegexToken,
  scanPostfixUpdateToken,
  scanRejectedEllipsisToken,
  scanQuoteToken,
  scanIdentifierToken,
  scanNumberToken,
];

function scanLineCommentToken(context: NormalCharacterScanContext): NormalScanResult | undefined {
  if (context.char !== "/" || context.code.charAt(context.index + 1) !== "/") {
    return undefined;
  }
  return { sane: true, skip: lineCommentSkipLength(context.code, context.index) };
}

function scanBlockCommentToken(context: NormalCharacterScanContext): NormalScanResult | undefined {
  if (context.char !== "/" || context.code.charAt(context.index + 1) !== "*") {
    return undefined;
  }
  return { sane: true, skip: 1, inBlockComment: true };
}

function scanJsxClosingToken(context: NormalCharacterScanContext): NormalScanResult | undefined {
  if (context.char !== "<" || context.code.charAt(context.index + 1) !== "/") {
    return undefined;
  }
  return scanJsxClosingTag(context.code, context.index);
}

function scanJsxOpeningToken(context: NormalCharacterScanContext): NormalScanResult | undefined {
  if (context.char !== "<" || isOperandToken(context.previousSignificant)) {
    return undefined;
  }
  return scanJsxOpeningTag(context.code, context.index);
}

function scanJsxTextToken(context: NormalCharacterScanContext): NormalScanResult | undefined {
  if (!isJsxTextContext(context.previousSignificant) || !canStartJsxText(context.char)) {
    return undefined;
  }
  return scanJsxTextContent(context.code, context.index);
}

function scanRegexToken(context: NormalCharacterScanContext): NormalScanResult | undefined {
  if (context.char !== "/" || !canStartRegexLiteral(context.previousSignificant)) {
    return undefined;
  }
  return { sane: true, inRegex: true };
}

function scanPostfixUpdateToken(context: NormalCharacterScanContext): NormalScanResult | undefined {
  if (
    !isPostfixUpdateOperator(context.code, context.index, context.char, context.previousSignificant)
  ) {
    return undefined;
  }
  return { sane: true, skip: 1, previousSignificant: "literal" };
}

function scanRejectedEllipsisToken(
  context: NormalCharacterScanContext,
): NormalScanResult | undefined {
  if (
    context.char !== "\u2026" &&
    !startsRejectedAsciiEllipsis(context.code, context.index, context.previousSignificant)
  ) {
    return undefined;
  }
  return { sane: false };
}

function scanQuoteToken(context: NormalCharacterScanContext): NormalScanResult | undefined {
  if (!QuoteCharacters.has(context.char)) {
    return undefined;
  }
  if (context.char !== "`" && isOperandToken(context.previousSignificant)) {
    return { sane: false };
  }
  return { sane: true, quote: context.char };
}

function scanIdentifierToken(context: NormalCharacterScanContext): NormalScanResult | undefined {
  if (!isIdentifierStart(context.char)) {
    return undefined;
  }
  const identifier = readIdentifier(context.code, context.index);
  if (isUnexpectedAdjacentOperand(context.previousSignificant, identifier)) {
    return { sane: false };
  }
  return {
    sane: true,
    skip: identifier.length - 1,
    previousSignificant: significantIdentifierToken(identifier, context.previousSignificant),
  };
}

function scanNumberToken(context: NormalCharacterScanContext): NormalScanResult | undefined {
  if (!isDecimalDigit(context.char)) {
    return undefined;
  }
  const literal = readNumberLiteral(context.code, context.index);
  if (
    !isSupportedNumberLiteral(literal) ||
    isUnexpectedAdjacentOperand(context.previousSignificant, literal)
  ) {
    return { sane: false };
  }
  return { sane: true, skip: literal.length - 1, previousSignificant: "literal" };
}

function scanDelimiterOrToken(context: NormalCharacterScanContext): NormalScanResult {
  for (const scanner of DelimiterTokenScanners) {
    const result = scanner(context);
    if (result !== undefined) {
      return result;
    }
  }
  return { sane: true, previousSignificant: context.char };
}

const DelimiterTokenScanners: readonly NormalCharacterScanner[] = [
  scanComparisonOperatorToken,
  scanQuestionToken,
  scanColonToken,
  scanNonNullAssertionToken,
  scanCommaToken,
  scanStatementTerminatorToken,
  scanOpeningDelimiterToken,
  scanClosingDelimiterToken,
  scanSpreadToken,
];

function scanComparisonOperatorToken(
  context: NormalCharacterScanContext,
): NormalScanResult | undefined {
  const comparisonToken = scanComparisonToken(context.char, context.previousSignificant);
  if (comparisonToken !== undefined) {
    return { sane: true, previousSignificant: comparisonToken };
  }

  return undefined;
}

function scanQuestionToken(context: NormalCharacterScanContext): NormalScanResult | undefined {
  if (context.char !== "?") {
    return undefined;
  }
  const next = context.code.charAt(context.index + 1);
  if (next === "?") {
    return { sane: true, skip: 1, previousSignificant: context.char };
  }
  if (next === ".") {
    return { sane: true, skip: 1, previousSignificant: "." };
  }
  markTopDelimiterContainsTernary(context.delimiterStack);
  return { sane: true, previousSignificant: context.char, opensTernary: true };
}

function scanColonToken(context: NormalCharacterScanContext): NormalScanResult | undefined {
  if (context.char !== ":") {
    return undefined;
  }
  if (
    context.code.charAt(context.index + 1) === ":" &&
    isOperandToken(context.previousSignificant)
  ) {
    return { sane: true, skip: 1, previousSignificant: "." };
  }
  if (isCannotPrecedeColonToken(context.previousSignificant)) {
    return { sane: false, previousSignificant: context.char };
  }
  return { sane: true, previousSignificant: context.char, closesTernary: true };
}

function scanNonNullAssertionToken(
  context: NormalCharacterScanContext,
): NormalScanResult | undefined {
  if (context.char !== "!" || !isOperandToken(context.previousSignificant)) {
    return undefined;
  }
  return { sane: true, previousSignificant: "literal" };
}

function scanCommaToken(context: NormalCharacterScanContext): NormalScanResult | undefined {
  if (context.char !== ",") {
    return undefined;
  }
  if (
    (context.previousSignificant === "," || isOpeningDelimiterToken(context.previousSignificant)) &&
    !isArrayElisionComma(context.previousSignificant, context.delimiterStack)
  ) {
    return { sane: false, previousSignificant: context.char };
  }
  return { sane: true, previousSignificant: context.char };
}

function scanStatementTerminatorToken(
  context: NormalCharacterScanContext,
): NormalScanResult | undefined {
  if (context.char !== ";") {
    return undefined;
  }
  if (
    isCannotEndToken(context.previousSignificant) &&
    !StatementTerminatorAllowedPrefixKeywords.has(context.previousSignificant ?? "")
  ) {
    return { sane: false, previousSignificant: context.char };
  }
  return { sane: true, previousSignificant: context.char };
}

function scanOpeningDelimiterToken(
  context: NormalCharacterScanContext,
): NormalScanResult | undefined {
  const expectedClosingDelimiter = OpeningDelimiters.get(context.char);
  if (expectedClosingDelimiter !== undefined) {
    context.delimiterStack.push({
      closing: expectedClosingDelimiter,
      resumesTemplate: false,
      openedAfterOperand: isOperandToken(context.previousSignificant),
      containsTernary: false,
      resumesJsxContent: context.char === "{" && context.previousSignificant === JsxContentToken,
    });
    return { sane: true, previousSignificant: context.char };
  }
  return undefined;
}

function scanClosingDelimiterToken(
  context: NormalCharacterScanContext,
): NormalScanResult | undefined {
  if (!ClosingDelimiters.has(context.char)) {
    return undefined;
  }
  if (
    isTerminalOperatorToken(context.previousSignificant) &&
    !isSliceClosingDelimiter(context.char, context.previousSignificant, context.delimiterStack)
  ) {
    return { sane: false, previousSignificant: context.char };
  }
  const entry = context.delimiterStack.pop();
  if (entry === undefined || entry.closing !== context.char) {
    return { sane: false, previousSignificant: context.char };
  }
  return {
    sane: true,
    resumeTemplate: entry.resumesTemplate,
    previousSignificant: entry.resumesJsxContent ? JsxContentToken : context.char,
  };
}

function scanSpreadToken(context: NormalCharacterScanContext): NormalScanResult | undefined {
  if (context.char !== "." || context.code.slice(context.index, context.index + 3) !== "...") {
    return undefined;
  }
  return { sane: true, skip: 2, previousSignificant: "..." };
}

function lineCommentSkipLength(code: string, index: number): number {
  const lineEnd = code.indexOf("\n", index + 2);
  const commentEnd = lineEnd === -1 ? code.length : lineEnd;
  return commentEnd - index - 1;
}

function scanJsxClosingTag(code: string, index: number): NormalScanResult | undefined {
  let cursor = index + 2;
  if (code.charAt(cursor) === ">") {
    return { sane: true, skip: cursor - index, previousSignificant: "literal" };
  }
  if (!isIdentifierStart(code.charAt(cursor))) {
    return undefined;
  }
  cursor += 1;
  while (cursor < code.length && isJsxTagNamePart(code.charAt(cursor))) {
    cursor += 1;
  }
  while (cursor < code.length && code.charAt(cursor) === " ") {
    cursor += 1;
  }
  if (code.charAt(cursor) !== ">") {
    return undefined;
  }
  return { sane: true, skip: cursor - index, previousSignificant: "literal" };
}

type JsxAttributeToken = "name" | "=" | "value";

type JsxOpeningTagState = {
  cursor: number;
  quote: string | undefined;
  escaping: boolean;
  previousAttributeToken: JsxAttributeToken | undefined;
};

function scanJsxOpeningTag(code: string, index: number): NormalScanResult | undefined {
  const tagHead = scanJsxOpeningTagHead(code, index);
  if (tagHead === undefined || "sane" in tagHead) {
    return tagHead;
  }

  const state: JsxOpeningTagState = {
    cursor: tagHead.cursor,
    quote: undefined,
    escaping: false,
    previousAttributeToken: undefined,
  };
  while (state.cursor < code.length) {
    const result = scanJsxOpeningTagCharacter(code, index, state);
    if (result !== undefined) {
      return result;
    }
  }
  return { sane: false };
}

function scanJsxOpeningTagHead(
  code: string,
  index: number,
): { readonly cursor: number } | NormalScanResult | undefined {
  const firstContentIndex = index + 1;
  if (code.charAt(firstContentIndex) === ">") {
    return { sane: true, skip: 1, previousSignificant: JsxContentToken };
  }
  if (!isIdentifierStart(code.charAt(firstContentIndex))) {
    return undefined;
  }

  let cursor = firstContentIndex + 1;
  while (cursor < code.length && isJsxTagNamePart(code.charAt(cursor))) {
    cursor += 1;
  }
  return { cursor };
}

function scanJsxOpeningTagCharacter(
  code: string,
  index: number,
  state: JsxOpeningTagState,
): NormalScanResult | undefined {
  const char = code.charAt(state.cursor);
  if (state.quote !== undefined) {
    consumeQuotedJsxAttributeCharacter(code, state, char);
    return undefined;
  }
  if (QuoteCharacters.has(char)) {
    return consumeJsxAttributeQuote(state, char);
  }
  if (char === "{") {
    return consumeJsxAttributeExpression(code, state);
  }
  if (char === "=") {
    return consumeJsxAttributeEquals(state);
  }
  if (isIdentifierStart(char)) {
    return consumeJsxAttributeName(code, state);
  }
  if (char === "}") {
    return { sane: false };
  }
  if (char === ">") {
    return closeJsxOpeningTag(index, state);
  }

  state.cursor += 1;
  return undefined;
}

function consumeQuotedJsxAttributeCharacter(
  code: string,
  state: JsxOpeningTagState,
  char: string,
): void {
  const quote = state.quote;
  if (quote === undefined) {
    return;
  }
  const quoted = scanQuotedCharacter(code, state.cursor, char, quote, state.escaping);
  state.escaping = quoted.escaping;
  if (quoted.closed) {
    state.quote = undefined;
    state.previousAttributeToken = "value";
  }
  state.cursor += 1;
}

function consumeJsxAttributeQuote(
  state: JsxOpeningTagState,
  char: string,
): NormalScanResult | undefined {
  if (char === "`" || state.previousAttributeToken !== "=") {
    return { sane: false };
  }
  state.quote = char;
  state.escaping = false;
  state.cursor += 1;
  return undefined;
}

function consumeJsxAttributeExpression(
  code: string,
  state: JsxOpeningTagState,
): NormalScanResult | undefined {
  const expression = scanJsxAttributeExpression(code, state.cursor);
  if (!expression.sane) {
    return { sane: false };
  }
  state.cursor += expression.skip + 1;
  state.previousAttributeToken = "value";
  return undefined;
}

function consumeJsxAttributeEquals(state: JsxOpeningTagState): NormalScanResult | undefined {
  if (state.previousAttributeToken !== "name") {
    return { sane: false };
  }
  state.previousAttributeToken = "=";
  state.cursor += 1;
  return undefined;
}

function consumeJsxAttributeName(
  code: string,
  state: JsxOpeningTagState,
): NormalScanResult | undefined {
  if (state.previousAttributeToken === "=") {
    return { sane: false };
  }
  state.cursor += scanJsxNameLength(code, state.cursor);
  state.previousAttributeToken = "name";
  return undefined;
}

function closeJsxOpeningTag(
  index: number,
  state: JsxOpeningTagState,
): NormalScanResult | undefined {
  if (state.previousAttributeToken === "=") {
    return { sane: false };
  }
  return { sane: true, skip: state.cursor - index, previousSignificant: JsxContentToken };
}

function scanJsxTextContent(code: string, index: number): NormalScanResult | undefined {
  let cursor = index;
  let sawText = false;
  while (cursor < code.length) {
    const char = code.charAt(cursor);
    if (char === "<" || char === "{") {
      if (!sawText) {
        return undefined;
      }
      return { sane: true, skip: cursor - index - 1, previousSignificant: JsxContentToken };
    }
    if (char === "}") {
      return { sane: false };
    }
    if (!isWhitespace(char)) {
      sawText = true;
    }
    cursor += 1;
  }
  return undefined;
}

function isJsxTextContext(previousSignificant: string | undefined): boolean {
  return previousSignificant === JsxContentToken;
}

function canStartJsxText(char: string): boolean {
  return !ClosingDelimiters.has(char) && char !== ";" && char !== ",";
}

function isJsxTagNamePart(char: string): boolean {
  return (
    isIdentifierStart(char) || isDecimalDigit(char) || char === "-" || char === "." || char === ":"
  );
}

function isOpeningDelimiterToken(token: string | undefined): boolean {
  return token !== undefined && OpeningDelimiters.has(token);
}

function isArrayElisionComma(
  previousSignificant: string | undefined,
  delimiterStack: DelimiterStackEntry[],
): boolean {
  const entry = delimiterStack[delimiterStack.length - 1];
  return (
    (previousSignificant === "[" || previousSignificant === ",") &&
    entry?.closing === "]" &&
    !entry.openedAfterOperand
  );
}

function scanJsxNameLength(code: string, start: number): number {
  let cursor = start + 1;
  while (cursor < code.length && isJsxTagNamePart(code.charAt(cursor))) {
    cursor += 1;
  }
  return cursor - start;
}

function isSliceClosingDelimiter(
  char: string,
  previousSignificant: string | undefined,
  delimiterStack: DelimiterStackEntry[],
): boolean {
  if (char !== "]" || previousSignificant !== ":") {
    return false;
  }
  const entry = delimiterStack[delimiterStack.length - 1];
  return entry?.closing === "]" && entry.openedAfterOperand && !entry.containsTernary;
}

function markTopDelimiterContainsTernary(delimiterStack: DelimiterStackEntry[]): void {
  const topIndex = delimiterStack.length - 1;
  const entry = delimiterStack[topIndex];
  if (entry === undefined) {
    return;
  }
  delimiterStack[topIndex] = { ...entry, containsTernary: true };
}

function scanJsxAttributeExpression(code: string, start: number): SyntaxFragmentScanResult {
  return scanSyntaxFragment(code, start, {
    stopAfterBalancedDelimiter: true,
    rejectEmptyInitialDelimiter: true,
  });
}

type SyntaxScanState = {
  readonly delimiterStack: DelimiterStackEntry[];
  readonly pendingTernaryDepths: number[];
  quote: string | undefined;
  escaping: boolean;
  inBlockComment: boolean;
  inRegex: boolean;
  inRegexClass: boolean;
  previousSignificant: string | undefined;
};

type SyntaxScanStep =
  | {
      readonly sane: true;
      readonly skip: number;
      readonly stop?: boolean;
    }
  | {
      readonly sane: false;
      readonly skip: number;
    };

export function scanSyntaxFragment(
  code: string,
  start = 0,
  options: SyntaxFragmentScanOptions = {},
): SyntaxFragmentScanResult {
  const stopAfterBalancedDelimiter = options.stopAfterBalancedDelimiter ?? false;
  const rejectEmptyInitialDelimiter = options.rejectEmptyInitialDelimiter ?? false;
  const state = createSyntaxScanState();

  for (let index = start; index < code.length; index += 1) {
    const step = scanSyntaxCharacter(code, index, start, state, rejectEmptyInitialDelimiter);
    if (!step.sane) {
      return step;
    }
    if (step.stop) {
      break;
    }
    index += step.skip;
    if (stopAfterBalancedDelimiter && index > start && state.delimiterStack.length === 0) {
      return {
        sane: isCompleteSyntaxState(state),
        skip: index - start,
      };
    }
  }

  return {
    sane: !stopAfterBalancedDelimiter && isCompleteSyntaxState(state),
    skip: code.length - start,
  };
}

function createSyntaxScanState(): SyntaxScanState {
  return {
    delimiterStack: [],
    pendingTernaryDepths: [],
    quote: undefined,
    escaping: false,
    inBlockComment: false,
    inRegex: false,
    inRegexClass: false,
    previousSignificant: undefined,
  };
}

function scanSyntaxCharacter(
  code: string,
  index: number,
  start: number,
  state: SyntaxScanState,
  rejectEmptyInitialDelimiter: boolean,
): SyntaxScanStep {
  const char = code.charAt(index);
  if (state.inBlockComment) {
    return scanBlockCommentCharacter(code, index, state);
  }
  if (state.quote !== undefined) {
    return scanQuotedSyntaxCharacter(code, index, state);
  }
  if (state.inRegex) {
    return scanRegexSyntaxCharacter(code, index, start, state);
  }
  if (isWhitespace(char)) {
    return { sane: true, skip: 0 };
  }
  if (isRejectedEmptyInitialDelimiter(char, index, start, state, rejectEmptyInitialDelimiter)) {
    return { sane: false, skip: index - start };
  }
  return scanNormalSyntaxCharacter(code, index, start, char, state);
}

function scanBlockCommentCharacter(
  code: string,
  index: number,
  state: SyntaxScanState,
): SyntaxScanStep {
  if (code.charAt(index) === "*" && code.charAt(index + 1) === "/") {
    state.inBlockComment = false;
    return { sane: true, skip: 1 };
  }
  return { sane: true, skip: 0 };
}

function scanQuotedSyntaxCharacter(
  code: string,
  index: number,
  state: SyntaxScanState,
): SyntaxScanStep {
  const quote = state.quote;
  if (quote === undefined) {
    return { sane: true, skip: 0 };
  }
  const result = scanQuotedCharacter(code, index, code.charAt(index), quote, state.escaping);
  state.escaping = result.escaping;
  if (result.opensTemplateExpression) {
    enterTemplateExpressionState(state);
    return { sane: true, skip: 1 };
  }
  if (result.closed) {
    state.quote = undefined;
    state.previousSignificant = "literal";
  }
  return { sane: true, skip: 0 };
}

function enterTemplateExpressionState(state: SyntaxScanState): void {
  state.quote = undefined;
  state.delimiterStack.push({
    closing: "}",
    resumesTemplate: true,
    openedAfterOperand: false,
    containsTernary: false,
    resumesJsxContent: false,
  });
  state.previousSignificant = "=";
}

function scanRegexSyntaxCharacter(
  code: string,
  index: number,
  start: number,
  state: SyntaxScanState,
): SyntaxScanStep {
  const result = scanRegexCharacter(code.charAt(index), state.escaping, state.inRegexClass);
  state.escaping = result.escaping;
  state.inRegexClass = result.inRegexClass;
  if (!result.closed) {
    return { sane: true, skip: 0 };
  }

  const flags = scanRegexFlags(code, index + 1);
  if (!flags.sane) {
    return { sane: false, skip: index - start };
  }
  state.inRegex = false;
  state.previousSignificant = "literal";
  return { sane: true, skip: flags.skip };
}

function isRejectedEmptyInitialDelimiter(
  char: string,
  index: number,
  start: number,
  state: SyntaxScanState,
  rejectEmptyInitialDelimiter: boolean,
): boolean {
  return (
    rejectEmptyInitialDelimiter &&
    index > start &&
    char === "}" &&
    state.delimiterStack.length === 1 &&
    state.previousSignificant === "{"
  );
}

function scanNormalSyntaxCharacter(
  code: string,
  index: number,
  start: number,
  char: string,
  state: SyntaxScanState,
): SyntaxScanStep {
  const token = scanNormalCharacter(
    code,
    index,
    char,
    state.previousSignificant,
    state.delimiterStack,
  );
  if (!token.sane) {
    return { sane: false, skip: index - start };
  }
  if (token.stop) {
    return { sane: true, skip: 0, stop: true };
  }
  return { sane: true, skip: applyNormalToken(token, state) };
}

function applyNormalToken(token: NormalScanResult, state: SyntaxScanState): number {
  if (token.quote !== undefined) {
    state.quote = token.quote;
    state.escaping = false;
  }
  if (token.inBlockComment) {
    state.inBlockComment = true;
  }
  if (token.inRegex) {
    state.inRegex = true;
    state.inRegexClass = false;
    state.escaping = false;
  }
  if (token.resumeTemplate) {
    state.quote = "`";
    state.escaping = false;
  }
  applyTernaryToken(token, state);
  if (token.previousSignificant !== undefined) {
    state.previousSignificant = token.previousSignificant;
  }
  return token.skip ?? 0;
}

function applyTernaryToken(token: NormalScanResult, state: SyntaxScanState): void {
  if (token.opensTernary) {
    state.pendingTernaryDepths.push(state.delimiterStack.length);
  }
  if (!token.closesTernary) {
    return;
  }
  const pendingDepth = state.pendingTernaryDepths[state.pendingTernaryDepths.length - 1];
  if (pendingDepth === state.delimiterStack.length) {
    state.pendingTernaryDepths.pop();
  }
}

function isCompleteSyntaxState(state: SyntaxScanState): boolean {
  return (
    state.delimiterStack.length === 0 &&
    state.pendingTernaryDepths.length === 0 &&
    state.quote === undefined &&
    !state.inBlockComment &&
    !state.inRegex &&
    !isCannotEndToken(state.previousSignificant)
  );
}
