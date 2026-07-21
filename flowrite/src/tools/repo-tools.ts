import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// sbt/mdoc/docusaurus verification is done through the agents' own shell, not
// custom tool wrappers: the Differ run (2026-07-10) showed wrappers hide error
// detail the model needs (it recovered by running `sbt "last <scope>"` raw),
// while the invocation knowledge they encoded fits in one instruction line
// each (mdoc-conventions skill, examples-builder.md). Wrap a command in a tool
// only when code must enforce something about it, never merely to invoke it.

/** Derive the `owner/repo` slug from the checkout's origin remote. */
async function githubSlug(cwd: string, signal?: AbortSignal): Promise<string> {
  const { stdout } = await execFileAsync('git', ['config', '--get', 'remote.origin.url'], { cwd, signal });
  const m = stdout.trim().match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
  if (!m) throw new Error(`Cannot derive a github.com owner/repo from origin remote: ${stdout.trim()}`);
  return m[1];
}

/**
 * Search the library's GitHub issues and PRs for design rationale via the `gh`
 * CLI (`gh search issues` / `gh search prs`). Exported standalone so read-only
 * profiles (e.g. researcher) can take just this tool.
 *
 * Was `sbt gh-query` (a task no target repo defines — every call failed after a
 * ~65s sbt boot and the failure was swallowed). `gh` reads HTTPS_PROXY from the
 * process env, so it works behind a proxy without extra wiring.
 */
export function createGhQueryTool(repoPath: string) {
  return defineTool({
    name: 'gh_query',
    description:
      'Search the library GitHub issues and PRs for design rationale via the gh CLI.',
    input: v.object({ query: v.string() }),
    output: v.object({ output: v.string() }),
    async run({ input, signal }) {
      const slug = await githubSlug(repoPath, signal);
      const search = async (kind: 'issues' | 'prs') => {
        const { stdout } = await execFileAsync(
          'gh',
          ['search', kind, '--repo', slug, input.query, '--limit', '15', '--json', 'number,title,url,state'],
          { cwd: repoPath, signal, maxBuffer: 16 * 1024 * 1024 },
        );
        const rows = JSON.parse(stdout) as Array<{ number: number; title: string; url: string; state: string }>;
        const body = rows.length
          ? rows.map((r) => `- #${r.number} [${r.state}] ${r.title} — ${r.url}`).join('\n')
          : '(none)';
        return `## ${kind}\n${body}`;
      };
      // execFile rejects on non-zero exit, so a real gh failure propagates as an
      // error result (isError=true) instead of being silently returned as output.
      const [issues, prs] = await Promise.all([search('issues'), search('prs')]);
      return { output: `${issues}\n\n${prs}` };
    },
  });
}
