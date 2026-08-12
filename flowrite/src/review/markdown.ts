/**
 * Markdown structure, extracted once and shared by every mechanical check.
 *
 * Deliberately not a markdown parser: it recognizes fenced code blocks, ATX headings, frontmatter
 * and inline code, which is the whole vocabulary the writing-style rules are stated in. Fourteen
 * graders would otherwise each re-implement "is this line inside a code block", and the ones that
 * got it wrong would report violations that are not there — worse than no grader, because the writer
 * spends a turn "fixing" nothing.
 */

export interface Fence {
  /** 0-based index of the opening fence line. */
  start: number;
  /** 0-based index of the closing fence line, or the last line when the fence never closes. */
  end: number;
  /** The info string after the backticks, e.g. `scala mdoc:compile-only`. */
  info: string;
}

export interface Heading {
  /** 0-based line index. */
  line: number;
  /** 1 for `#`, 2 for `##`, up to 6. */
  level: number;
  /** The heading text, without the hashes. */
  text: string;
}

const FENCE = /^\s*(`{3,}|~{3,})(.*)$/;

/**
 * Every fenced code block, in document order.
 *
 * A fence closes only on the same marker character it opened with, so a ``` block containing ~~~ (or
 * the reverse) stays one block. An unterminated fence runs to the end of the file rather than being
 * dropped — a truncated page should not make prose rules start firing inside Scala code.
 */
export function fences(lines: string[]): Fence[] {
  const out: Fence[] = [];
  let start = -1;
  let info = '';
  let marker = '';

  for (let i = 0; i < lines.length; i++) {
    const match = FENCE.exec(lines[i]);
    if (match === null) continue;
    if (start < 0) {
      start = i;
      marker = match[1][0];
      info = match[2].trim();
    } else if (match[1][0] === marker) {
      out.push({ start, end: i, info });
      start = -1;
    }
  }
  if (start >= 0) out.push({ start, end: lines.length - 1, info });
  return out;
}

/**
 * One boolean per line: true inside a fence, including its two fence lines.
 *
 * The fence lines count as inside so that a rule about prose never fires on ```` ```scala ````.
 */
export function fenceMask(lines: string[]): boolean[] {
  const mask: boolean[] = new Array(lines.length).fill(false);
  for (const fence of fences(lines)) {
    for (let i = fence.start; i <= fence.end && i < mask.length; i++) mask[i] = true;
  }
  return mask;
}

/**
 * ATX headings (`## Title`) outside code blocks.
 *
 * Setext headings (an `===` underline) are not used anywhere in this corpus and are not recognized;
 * a page that used them would simply have no headings to check, never a false violation.
 */
export function headings(lines: string[]): Heading[] {
  const mask = fenceMask(lines);
  const out: Heading[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (mask[i]) continue;
    const match = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
    if (match !== null) out.push({ line: i, level: match[1].length, text: match[2].trim() });
  }
  return out;
}

/**
 * The frontmatter block's scalar fields, or `{}` when the page has none.
 *
 * Values written by `buildFrontmatter` (src/shared/frontmatter.ts) are JSON-encoded, so they are
 * decoded here — a `title` compared against a heading has to be the real text, not `"Prism"` with
 * quotes. Block lists (`keywords`) are skipped: no style rule refers to them.
 */
export function frontmatterFields(lines: string[]): Record<string, string> {
  if (lines[0]?.trim() !== '---') return {};
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
  if (end < 0) return {};

  const fields: Record<string, string> = {};
  for (const line of lines.slice(1, end)) {
    const match = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (match === null) continue;
    const raw = match[2].trim();
    if (raw === '') continue;
    let value = raw;
    if (raw.startsWith('"')) {
      try {
        value = JSON.parse(raw) as string;
      } catch {
        /* not valid JSON — keep the raw text */
      }
    }
    fields[match[1]] = value;
  }
  return fields;
}

/** The line index where the frontmatter block ends, or -1 when there is none. */
export function frontmatterEnd(lines: string[]): number {
  if (lines[0]?.trim() !== '---') return -1;
  return lines.findIndex((line, i) => i > 0 && line.trim() === '---');
}

/**
 * Text with `inline code` spans removed.
 *
 * Identifiers must not trip prose rules: `## Working with Chunk#map` is correct Title Case, and
 * `Chunk#map` is not a lowercase word. Every prose-shaped rule strips code first.
 */
export const stripInlineCode = (text: string): string => text.replace(/`[^`]*`/g, '');

/** 0-based index → the 1-based line number a human or a model expects to see. */
export const at = (index: number): number => index + 1;
