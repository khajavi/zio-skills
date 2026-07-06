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
async function runSbt(command: string, repoPath: string, signal?: AbortSignal) {
  try {
    const { stdout, stderr } = await execFileAsync('sbt', [command], {
      cwd: repoPath,
      signal,
      maxBuffer: 64 * 1024 * 1024,
    });
    return { ok: true, output: `${stdout}\n${stderr}` };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, output: [e.stdout, e.stderr, e.message].filter(Boolean).join('\n') };
  }
}

const errorLines = (output: string): string[] =>
  output.split('\n').filter((line) => line.includes('[error]'));

/**
 * Build the sbt/git tools bound to one library checkout. Called from the agent
 * initializer with the instance's `cwd` so each tool operates on that repo.
 */
export function createRepoTools(repoPath: string) {
  const mdocCompile = defineTool({
    name: 'mdoc_compile',
    description:
      'Compile ONE documentation markdown file through mdoc. Always scoped with --in so it never recompiles all docs (~90s). Returns any [error] lines.',
    input: v.object({
      file: v.pipe(
        v.string(),
        v.description('Path under the repo, e.g. docs/guides/scope.md'),
      ),
    }),
    output: v.object({ ok: v.boolean(), errors: v.array(v.string()) }),
    async run({ input, signal }) {
      const res = await runSbt(`docs/mdoc --in ${input.file}`, repoPath, signal);
      const errors = errorLines(res.output);
      return { ok: res.ok && errors.length === 0, errors };
    },
  });

  const compileExamples = defineTool({
    name: 'compile_examples',
    description: 'Compile a companion-examples sbt module, e.g. schema-examples.',
    input: v.object({ module: v.string() }),
    output: v.object({ ok: v.boolean(), errors: v.array(v.string()) }),
    async run({ input, signal }) {
      const res = await runSbt(`${input.module}/compile`, repoPath, signal);
      return { ok: res.ok, errors: errorLines(res.output) };
    },
  });

  const runExample = defineTool({
    name: 'run_example',
    description: 'Run one example main class to capture its printed output for the tutorial.',
    input: v.object({ module: v.string(), mainClass: v.string() }),
    output: v.object({ ok: v.boolean(), output: v.string() }),
    async run({ input, signal }) {
      const res = await runSbt(`${input.module}/runMain ${input.mainClass}`, repoPath, signal);
      return { ok: res.ok, output: res.output };
    },
  });

  return [mdocCompile, compileExamples, runExample, createGhQueryTool(repoPath)];
}

/**
 * Search the library's GitHub history (commits, issues, PRs) via `sbt gh-query`.
 * Exported standalone so read-only profiles (e.g. tutorial_researcher) can take
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
