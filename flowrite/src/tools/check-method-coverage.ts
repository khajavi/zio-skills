import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { getRepoPath } from '../runtime/run-context.ts';

const execFileAsync = promisify(execFile);

/**
 * Extract public member names declared in the given Scala source text. Heuristic
 * and textual — NOT a Scala parser: it matches `def`/`val`/`lazy val` declarations
 * that are not `private`/`protected`. Good enough to catch whole operations a
 * reference page forgot to document; it is not scaladoc-accurate.
 */
function extractPublicMembers(source: string): string[] {
  const names = new Set<string>();
  for (const raw of source.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('private') || line.startsWith('protected')) continue;
    // def name | val name | lazy val name ; name may be an operator like ++ or :+
    const m = /^(?:final\s+|override\s+|implicit\s+|sealed\s+)*(?:def|lazy\s+val|val)\s+([^\s\[(:={]+)/.exec(line);
    if (m) {
      const name = m[1];
      // skip constructors and obvious noise
      if (name && name !== 'this' && !name.startsWith('<')) names.add(name);
    }
  }
  return [...names];
}

/** A member is "documented" if the page mentions it as `name`, .name, #name, or `def name`. */
function isDocumented(page: string, member: string): boolean {
  const esc = member.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\`[^\`]*${esc}[^\`]*\`|[.#]${esc}\\b|\\bdef\\s+${esc}\\b`).test(page);
}

export interface CoverageResult {
  covered: string[];
  missing: string[];
  coveragePercent: number;
  sourceFiles: string[];
  note: string;
}

/**
 * Deterministic method-coverage computation, called by the review action (which
 * folds coverage into the single review gate). Extracts the type's public members
 * from source and diffs them against what the page documents. A model must never
 * self-report "I documented everything" — this is the code that enforces it.
 * `repoPath` is the checkout root; `pagePath` is relative to it.
 */
export async function computeMethodCoverage(
  repoPath: string,
  typeName: string,
  pagePath: string,
  signal?: AbortSignal,
): Promise<CoverageResult> {
  let sourceFiles: string[] = [];
  try {
    const { stdout } = await execFileAsync(
      'find',
      [repoPath, '-path', '*/src/main/*', '-name', `${typeName}.scala`],
      { signal, maxBuffer: 8 * 1024 * 1024 },
    );
    sourceFiles = stdout.split('\n').map((s) => s.trim()).filter(Boolean);
  } catch {
    sourceFiles = [];
  }

  if (sourceFiles.length === 0) {
    return {
      covered: [],
      missing: [],
      coveragePercent: 0,
      sourceFiles: [],
      note: `No source file named ${typeName}.scala found under a src/main tree — cannot compute coverage. Verify the type name or document coverage manually.`,
    };
  }

  const members = new Set<string>();
  for (const file of sourceFiles) {
    try {
      extractPublicMembers(await readFile(file, 'utf8')).forEach((m) => members.add(m));
    } catch {
      /* skip unreadable file */
    }
  }

  const page = await readFile(path.join(repoPath, pagePath), 'utf8');
  const covered: string[] = [];
  const missing: string[] = [];
  for (const member of members) {
    (isDocumented(page, member) ? covered : missing).push(member);
  }
  const total = covered.length + missing.length;
  const coveragePercent = total === 0 ? 100 : Math.round((covered.length / total) * 100);

  return {
    covered: covered.sort(),
    missing: missing.sort(),
    coveragePercent,
    sourceFiles,
    note:
      'Heuristic textual extraction (not a Scala parser): treat "missing" as candidates to double-check, ' +
      'not gospel. Confirm any surprising entry against the real source before adding or dismissing it.',
  };
}

/**
 * The same computation, model-callable.
 *
 * The review phase runs `computeMethodCoverage` directly as a gate, and must keep doing so: a
 * verdict that depended on the model choosing to check would be no verdict at all. This tool exists
 * for the opposite reason — so coverage stops being something a run only discovers at review time.
 * It is deterministic and free, so the writer can check a page, fix a gap, and check again for
 * nothing, instead of paying for a review round to learn that one operation is undocumented.
 *
 * Plain, not `harness: true`: it computes and returns. No sub-conversation, no delegation depth, and
 * nothing to re-enter — so it must NOT be registered through the guarded `tools` list, or it would be
 * refused exactly when a phase legitimately calls it.
 */
export const checkMethodCoverage = defineTool({
  name: 'check_method_coverage',
  description:
    'Check which of a type\'s public members a reference page documents. Deterministic and free — ' +
    'call it as often as you like while writing, rather than waiting for review to find a gap.',
  input: v.object({
    typeName: v.pipe(v.string(), v.description('The documented type, e.g. "Prism"')),
    path: v.pipe(
      v.string(),
      v.description('Repo-relative path of the page to check, e.g. docs/reference/prism.md'),
    ),
  }),
  output: v.object({
    coveragePercent: v.number(),
    covered: v.array(v.string()),
    missing: v.array(v.string()),
    sourceFiles: v.array(v.string()),
    note: v.string(),
  }),
  async run({ data }) {
    return { output: await computeMethodCoverage(getRepoPath(), data.typeName, data.path) };
  },
});
