import type { Check, ReviewItem } from '../check.ts';
import { fail, summarize } from '../item.ts';
import { fenceMask, maskInlineCode, type Span } from '../markdown.ts';

const isRow = (line: string): boolean => {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 1;
};

const isSeparator = (line: string): boolean => /^\s*\|[\s:|-]+\|\s*$/.test(line);

/** The raw cell texts of a row, spaces included — width is exactly what the source says. */
const cells = (line: string): string[] => {
  const trimmed = maskInlineCode(line).trim();
  return trimmed.slice(1, -1).split('|');
};

/**
 * The row's cell texts with their ORIGINAL characters — split at the same pipe positions the masked
 * view found, so a `|` inside inline code never splits a cell but the real backticked text survives.
 */
const rawCells = (line: string): string[] => {
  const raw = line.trim();
  const masked = maskInlineCode(line).trim();
  const out: string[] = [];
  let start = 1;
  for (let i = 1; i < masked.length - 1; i++) {
    if (masked[i] === '|') {
      out.push(raw.slice(start, i));
      start = i + 1;
    }
  }
  out.push(raw.slice(start, masked.length - 1));
  return out;
};

/**
 * The table rebuilt with every column padded to one width — the compliant text, computed rather than
 * described. Returns null for a ragged table (rows disagree on the column count), where guessing a
 * rebuild could drop content.
 */
export function padTable(lines: string[], table: Span): string[] | null {
  const rows = [];
  for (let i = table.start; i <= table.end; i++) rows.push(rawCells(lines[i]));
  const width = rows[0].length;
  if (rows.some((row) => row.length !== width)) return null;

  // Row 1 is the separator: its dashes are rebuilt to the column width, not measured for it.
  const trimmed = rows.map((row) => row.map((cell) => cell.trim()));
  const content = trimmed.filter((_, r) => r !== 1);
  const widths = Array.from({ length: width }, (_, column) =>
    Math.max(3, ...content.map((row) => row[column].length)),
  );
  return trimmed.map((row, r) =>
    r === 1
      ? `|${widths.map((w) => '-'.repeat(w + 2)).join('|')}|`
      : `| ${row.map((cell, column) => cell.padEnd(widths[column])).join(' | ')} |`,
  );
}

/** Markdown tables outside code blocks: a header row, a separator row, then body rows. */
export function tables(lines: string[]): Span[] {
  const mask = fenceMask(lines);
  const out: Span[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (mask[i] || !isRow(lines[i]) || !(i + 1 < lines.length && isSeparator(lines[i + 1]))) continue;
    let end = i + 1;
    while (end + 1 < lines.length && !mask[end + 1] && isRow(lines[end + 1])) end++;
    out.push({ start: i, end });
    i = end;
  }
  return out;
}

/**
 * Rule 22: align table columns with spaces for readability.
 *
 * Two ways a table fails: rows disagree on how many columns exist, or a column's cells are not padded
 * to one width. Both are decided from the source text, which is why inline code is masked to
 * same-length filler first — a cell containing `` `a|b` `` must not split on the pipe inside it, but
 * its width has to stay exactly what the author typed.
 */
export const style22: Check = {
  id: 'style-22',
  kind: 'code',
  async run(ctx) {
    const failures: ReviewItem[] = [];

    for (const table of tables(ctx.lines)) {
      const rows = ctx.lines.slice(table.start, table.end + 1).map(cells);
      const width = rows[0].length;

      if (rows.some((row) => row.length !== width)) {
        failures.push(
          fail(
            'style-22',
            table.start,
            `This table's rows do not all have ${width} columns. Give every row the same cells, ` +
              `padded to a common width.`,
          ),
        );
        continue;
      }

      for (let column = 0; column < width; column++) {
        const widths = new Set(rows.map((row) => row[column].length));
        if (widths.size > 1) {
          // The finding carries the fix: this check already computed every width, and telling a model
          // "16 vs 18 characters" makes it do arithmetic — a measured run failed eight passes running
          // on exactly that, "padding adjustments kept missing by 1-2 characters". The compliant table
          // is computable, so it is included verbatim for the writer to paste.
          const padded = padTable(ctx.lines, table);
          failures.push(
            fail(
              'style-22',
              table.start,
              `Column ${column + 1} of this table is not padded to one width (${[...widths].sort((a, b) => a - b).join(', ')} ` +
                `characters). Replace the whole table with this correctly padded version:\n` +
                (padded ?? []).join('\n'),
            ),
          );
          break;
        }
      }
    }
    return summarize('style-22', 'table column alignment', failures);
  },
};
