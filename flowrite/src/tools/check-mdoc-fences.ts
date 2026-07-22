import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Deterministic detector for executable Scala examples that dodge compilation.
 * mdoc only compiles blocks carrying an `mdoc` modifier; a plain ```scala block
 * is rendered but never type-checked, so a runnable example (or a hallucinated
 * API) written as plain ```scala ships unverified. This flags plain ```scala
 * blocks that LOOK executable so the review gate can force an mdoc modifier.
 *
 * Heuristic and textual — NOT a Scala parser (same disclaimer as
 * check-method-coverage.ts): signature dumps, pseudocode, ASCII and sbt config
 * are left alone; false positives are resolved by the agent adding a modifier or
 * confirming the block is a genuine illustration.
 */

export interface FenceResult {
  flagged: { line: number; snippet: string }[];
  note: string;
}

// A line that OPENS a declaration (or is a comment) — never an execution on its own.
const DECL_OR_COMMENT =
  /^(?:package|import|def|val|var|lazy|trait|class|object|type|case|sealed|abstract|final|override|implicit|inline|private|protected|given|using|extension|enum)\b|^(?:\/\/|\/\*|\*)/;

/** Remove balanced parens so a default-arg `=` inside a signature isn't read as a body. */
function stripParens(s: string): string {
  let prev: string;
  let cur = s;
  do {
    prev = cur;
    cur = cur.replace(/\([^()]*\)/g, ''); // remove, not "()", so nested groups fully collapse
  } while (cur !== prev);
  return cur;
}

/** Does this source line execute something, vs merely declare a signature? */
function isExecutableLine(raw: string): boolean {
  const t = raw.trim();
  if (!t || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false;
  if (/^import\s+\S/.test(t)) return true;
  const bare = stripParens(t).replace(/=>/g, ''); // drop param lists + function arrows before the `=` test
  // `val`/`var`/`def` WITH a right-hand side (abstract `def f: T` / `val x: T` have no top-level `=`)
  if (/^(?:final\s+|lazy\s+|implicit\s+|private\s+|override\s+|inline\s+)*(?:val|var|def)\s+.*=\s*\S/.test(bare))
    return true;
  // A call/expression statement: not a declaration, and it invokes something.
  if (!DECL_OR_COMMENT.test(t) && /\(/.test(t)) return true;
  return false;
}

/**
 * Scan a markdown page for plain ```scala blocks (info-string exactly "scala",
 * no mdoc modifier) whose body contains an executable line. Returns one entry
 * per offending block, anchored at its opening fence. `repoPath` is the checkout
 * root; `pagePath` is relative to it.
 */
export async function checkMdocFences(repoPath: string, pagePath: string): Promise<FenceResult> {
  let text: string;
  try {
    text = await readFile(path.join(repoPath, pagePath), 'utf8');
  } catch {
    return { flagged: [], note: `Could not read ${pagePath} — skipped.` };
  }

  const lines = text.split('\n');
  const flagged: { line: number; snippet: string }[] = [];
  let inFence = false;
  let isCandidate = false;
  let fenceLine = 0;
  let firstExec = '';

  for (let i = 0; i < lines.length; i++) {
    const fence = /^```(.*)$/.exec(lines[i].trim());
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceLine = i + 1;
        firstExec = '';
        isCandidate = fence[1].trim() === 'scala'; // plain scala only; "scala mdoc:*" is fine
      } else {
        if (isCandidate && firstExec) flagged.push({ line: fenceLine, snippet: firstExec.slice(0, 80) });
        inFence = false;
        isCandidate = false;
      }
      continue;
    }
    if (inFence && isCandidate && !firstExec && isExecutableLine(lines[i])) firstExec = lines[i].trim();
  }

  return {
    flagged,
    note:
      'Heuristic (not a Scala parser): each flagged block is a plain ```scala block that looks executable ' +
      'and is therefore uncompiled. For each, add an mdoc modifier (compile-only default) so it is verified, ' +
      'OR confirm it is a genuine signature/pseudocode illustration and leave it plain.',
  };
}

/**
 * Roll the per-page fence scan into a single deterministic review item across
 * every page of a reference/tutorial. Shape matches the review actions' other
 * extraGates entries (see review-module-ref.ts / check-method-coverage.ts usage).
 */
export async function checkMdocFencesGate(
  repoPath: string,
  pagePaths: string[],
): Promise<{ item: string; pass: boolean; issue: string | null }> {
  const all: { file: string; line: number; snippet: string }[] = [];
  for (const p of pagePaths) {
    const { flagged } = await checkMdocFences(repoPath, p);
    for (const f of flagged) all.push({ file: p, ...f });
  }
  const n = all.length;
  return {
    item: `mdoc verification — ${n} unverified executable block(s)`,
    pass: n === 0,
    issue:
      n === 0
        ? null
        : `Plain \`\`\`scala blocks that look executable but are not compiled (heuristic — for each, ` +
          `add an mdoc modifier (compile-only default) or confirm it is a signature/pseudocode illustration): ` +
          all.map((f) => `${f.file}:${f.line} — ${f.snippet}`).join('; '),
  };
}
