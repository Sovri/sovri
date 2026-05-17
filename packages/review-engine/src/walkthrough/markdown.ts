// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

export function formatMarkdownText(value: string): string {
  return escapeMarkdownLinkDelimiters(escapeHtml(normalizeParagraph(value)));
}

export function formatTableCell(value: string): string {
  return escapeTablePipes(formatMarkdownText(value));
}

function normalizeParagraph(value: string): string {
  return value
    .split(/\s*\r?\n\s*/u)
    .filter((line) => line.length > 0)
    .join(" ");
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeTablePipes(value: string): string {
  return value.replaceAll("|", "\\|");
}

function escapeMarkdownLinkDelimiters(value: string): string {
  return splitInlineCodeSpans(value)
    .map((segment) =>
      segment.kind === "code"
        ? segment.text
        : segment.text.replaceAll("[", "\\[").replaceAll("]", "\\]"),
    )
    .join("");
}

type MarkdownSegment = {
  readonly kind: "code" | "text";
  readonly text: string;
};

function splitInlineCodeSpans(value: string): MarkdownSegment[] {
  const segments: MarkdownSegment[] = [];
  let cursor = 0;

  while (cursor < value.length) {
    const codeStart = findNextUnescapedBacktick(value, cursor);
    if (codeStart === undefined) {
      segments.push({ kind: "text", text: value.slice(cursor) });
      break;
    }

    const markerLength = readBacktickRunLength(value, codeStart);
    const codeEnd = findClosingBacktickRun(value, markerLength, codeStart + markerLength);
    if (codeEnd === undefined) {
      segments.push({ kind: "text", text: value.slice(cursor) });
      break;
    }

    if (codeStart > cursor) {
      segments.push({ kind: "text", text: value.slice(cursor, codeStart) });
    }

    segments.push({ kind: "code", text: value.slice(codeStart, codeEnd + markerLength) });
    cursor = codeEnd + markerLength;
  }

  return segments;
}

function findNextUnescapedBacktick(value: string, start: number): number | undefined {
  let cursor = start;

  while (cursor < value.length) {
    const nextBacktick = value.indexOf("`", cursor);
    if (nextBacktick === -1) {
      return undefined;
    }

    if (!isEscaped(value, nextBacktick)) {
      return nextBacktick;
    }

    cursor = nextBacktick + 1;
  }

  return undefined;
}

function readBacktickRunLength(value: string, start: number): number {
  let length = 0;

  while (value[start + length] === "`") {
    length += 1;
  }

  return length;
}

function findClosingBacktickRun(
  value: string,
  expectedLength: number,
  start: number,
): number | undefined {
  let cursor = start;

  while (cursor < value.length) {
    const codeEnd = value.indexOf("`", cursor);
    if (codeEnd === -1) {
      return undefined;
    }

    const markerLength = readBacktickRunLength(value, codeEnd);
    if (markerLength === expectedLength) {
      return codeEnd;
    }

    cursor = codeEnd + markerLength;
  }

  return undefined;
}

function isEscaped(value: string, index: number): boolean {
  let backslashCount = 0;

  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    backslashCount += 1;
  }

  return backslashCount % 2 === 1;
}
