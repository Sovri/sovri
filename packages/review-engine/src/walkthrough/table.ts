// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri contributors

export function formatTable(
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): string[] {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => row[index]?.length ?? 0)),
  );

  return [
    formatTableRow(headers, widths),
    formatTableRow(
      widths.map((width) => "-".repeat(width)),
      widths,
    ),
    ...rows.map((row) => formatTableRow(row, widths)),
  ];
}

function formatTableRow(cells: readonly string[], widths: readonly number[]): string {
  const paddedCells = cells.map((cell, index) => ` ${cell.padEnd(widths[index] ?? cell.length)} `);
  return `|${paddedCells.join("|")}|`;
}
