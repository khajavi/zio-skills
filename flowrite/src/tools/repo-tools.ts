import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Run one sbt command inside `repoPath`. A single command string is passed as a
 * single argv element, matching how sbt treats a quoted `sbt "task args"`.
 * The local() sandbox is the host, so running sbt from the tool (app code) and
 * from the agent's shell target the same filesystem.
 */
async function runSbt(command: string, cwd: string, signal?: AbortSignal) {
  try {
    const { stdout, stderr } = await execFileAsync('sbt', [command], {
      cwd,
      signal,
      maxBuffer: 64 * 1024 * 1024,
    });
    return { ok: true, output: `${stdout}\n${stderr}` };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, output: [e.stdout, e.stderr, e.message].filter(Boolean).join('\n') };
  }
}

// sbt/mdoc/docusaurus verification is done through the agents' own shell, not
// custom tool wrappers: the Differ run (2026-07-10) showed wrappers hide error
// detail the model needs (it recovered by running `sbt "last <scope>"` raw),
// while the invocation knowledge they encoded fits in one instruction line
// each (mdoc-conventions skill, examples-builder.md). Wrap a command in a tool
// only when code must enforce something about it, never merely to invoke it.

/**
 * Search the library's GitHub history (commits, issues, PRs) via `sbt gh-query`.
 * Exported standalone so read-only profiles (e.g. researcher) can take
 * just this tool without pulling in the write-verification sbt tools.
 */
export function createGhQueryTool(repoPath: string) {
  return defineTool({
    name: 'gh_query',
    description:
      'Search the library GitHub history (commits, issues, PRs) for design rationale via sbt gh-query.',
    input: v.object({ query: v.string() }),
    output: v.object({ output: v.string() }),
    async run({ input, signal }) {
      const res = await runSbt(`gh-query ${input.query}`, repoPath, signal);
      return { output: res.output };
    },
  });
}
