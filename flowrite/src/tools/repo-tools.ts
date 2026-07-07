import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import path from 'node:path';

const execFileAsync = promisify(execFile);

/** Pick the package manager a JS project actually uses, from its lockfile. Defaults to npm. */
function detectPackageManager(dir: string): 'pnpm' | 'yarn' | 'npm' {
  if (existsSync(path.join(dir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(path.join(dir, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

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
 * Compile one or more documentation markdown files through mdoc. Always scoped
 * with --in (one pair per file) so it never recompiles all docs (~90s).
 * Returns any [error] lines.
 */
export function createMdocCompileTool(repoPath: string) {
  return defineTool({
    name: 'mdoc_compile',
    description:
      'Compile one or more documentation markdown files through mdoc, each scoped with --in/--out ' +
      'so it never recompiles all docs (~90s). Returns any [error] lines.',
    input: v.object({
      files: v.pipe(
        v.array(
          v.object({
            in: v.pipe(v.string(), v.description('Source path under docs/, e.g. docs/guides/scope.md')),
            out: v.optional(
              v.pipe(
                v.string(),
                v.description('Output path, e.g. website/docs/guides/scope.md. Omit to use the project mdocOut default.'),
              ),
            ),
          }),
        ),
        v.minLength(1),
      ),
    }),
    output: v.object({ ok: v.boolean(), errors: v.array(v.string()) }),
    async run({ input, signal }) {
      const args = input.files
        .map((f) => (f.out ? `--in ${f.in} --out ${f.out}` : `--in ${f.in}`))
        .join(' ');
      const res = await runSbt(`docs/mdoc ${args}`, repoPath, signal);
      const errors = errorLines(res.output);
      return { ok: res.ok && errors.length === 0, errors };
    },
  });
}

/** Compile a companion-examples sbt module, e.g. schema-examples. */
export function createCompileExamplesTool(repoPath: string) {
  return defineTool({
    name: 'compile_examples',
    description: 'Compile a companion-examples sbt module, e.g. schema-examples.',
    input: v.object({ module: v.string() }),
    output: v.object({ ok: v.boolean(), errors: v.array(v.string()) }),
    async run({ input, signal }) {
      const res = await runSbt(`${input.module}/compile`, repoPath, signal);
      return { ok: res.ok, errors: errorLines(res.output) };
    },
  });
}

/** Run one example main class to capture its printed output for the tutorial. */
export function createRunExampleTool(repoPath: string) {
  return defineTool({
    name: 'run_example',
    description: 'Run one example main class to capture its printed output for the tutorial.',
    input: v.object({ module: v.string(), mainClass: v.string() }),
    output: v.object({ ok: v.boolean(), output: v.string() }),
    async run({ input, signal }) {
      const res = await runSbt(`${input.module}/runMain ${input.mainClass}`, repoPath, signal);
      return { ok: res.ok, output: res.output };
    },
  });
}

/**
 * Run the Docusaurus site's production build (in `website/`) to catch broken links
 * and doc-id errors. Detects pnpm/yarn/npm from the lockfile present in `website/`
 * rather than assuming one — the tinyoptics fixture itself uses pnpm, not yarn.
 */
export function createBuildWebsiteTool(repoPath: string) {
  return defineTool({
    name: 'build_website',
    description:
      "Run the Docusaurus site's production build (website/) to catch broken links and doc-id errors. Detects pnpm/yarn/npm from the lockfile.",
    input: v.object({}),
    output: v.object({ ok: v.boolean(), output: v.string() }),
    async run({ signal }) {
      const dir = path.join(repoPath, 'website');
      const pm = detectPackageManager(dir);
      const args = pm === 'npm' ? ['run', 'build'] : ['build'];
      try {
        const { stdout, stderr } = await execFileAsync(pm, args, {
          cwd: dir,
          signal,
          maxBuffer: 64 * 1024 * 1024,
        });
        return { ok: true, output: `${stdout}\n${stderr}` };
      } catch (err) {
        const e = err as { stdout?: string; stderr?: string; message?: string };
        return { ok: false, output: [e.stdout, e.stderr, e.message].filter(Boolean).join('\n') };
      }
    },
  });
}

/**
 * Build the full sbt/git tool set bound to one library checkout. Called from the agent
 * initializer with the instance's `cwd` so each tool operates on that repo.
 */
export function createRepoTools(repoPath: string) {
  return [
    createMdocCompileTool(repoPath),
    createCompileExamplesTool(repoPath),
    createRunExampleTool(repoPath),
    createGhQueryTool(repoPath),
  ];
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
