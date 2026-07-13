import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

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

/**
 * Deterministic method-coverage gate for data type reference pages. Extracts the
 * type's public members from source and diffs them against what the written page
 * documents, returning the missing set. Implemented as a tool (not a subagent)
 * on purpose: coverage is a mechanical extract+diff, and a model must never be
 * trusted to self-report "I documented everything" — the same reason the review
 * action caps model self-assessment. See repo-tools.ts's note on when to wrap a
 * command in a tool.
 *
 * `repoPath` is the checkout root (baked in like createGhQueryTool); `pagePath`
 * is relative to it (e.g. docs/reference/chunk.md).
 */
export function createMethodCoverageTool(repoPath: string) {
  return defineTool({
    name: 'check_method_coverage',
    description:
      "Deterministically check a data type reference page documents the type's full public API. " +
      'Returns the covered and missing member names and a coverage percent.',
    input: v.object({
      typeName: v.pipe(v.string(), v.description('The documented type, e.g. "Chunk"')),
      pagePath: v.pipe(v.string(), v.description('Reference page path relative to the checkout, e.g. docs/reference/chunk.md')),
    }),
    output: v.object({
      covered: v.array(v.string()),
      missing: v.array(v.string()),
      coveragePercent: v.number(),
      sourceFiles: v.array(v.string()),
      note: v.string(),
    }),
    async run({ input, signal }) {
      // Locate the type's source file(s) under a main source tree.
      let sourceFiles: string[] = [];
      try {
        const { stdout } = await execFileAsync(
          'find',
          [repoPath, '-path', '*/src/main/*', '-name', `${input.typeName}.scala`],
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
          note: `No source file named ${input.typeName}.scala found under a src/main tree — cannot compute coverage. Verify the type name or document coverage manually.`,
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

      const page = await readFile(path.join(repoPath, input.pagePath), 'utf8');
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
    },
  });
}
