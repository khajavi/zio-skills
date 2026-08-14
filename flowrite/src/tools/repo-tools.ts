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
export function createGhQueryTool(resolveRepoPath: () => string) {
  return defineTool({
    name: 'gh_query',
    description:
      'Search the library GitHub issues and PRs for design rationale via the gh CLI.',
    input: v.object({ query: v.string() }),
    output: v.object({ output: v.string() }),
    async run({ data, signal }) {
      // Resolved per call, not at construction: a role module is imported long
      // before the writer's render knows the checkout path.
      const repoPath = resolveRepoPath();
      const slug = await githubSlug(repoPath, signal);
      const search = async (kind: 'issues' | 'prs') => {
        const { stdout } = await execFileAsync(
          'gh',
          ['search', kind, '--repo', slug, data.query, '--limit', '15', '--json', 'number,title,url,state'],
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
      return { output: { output: `${issues}\n\n${prs}` } };
    },
  });
}

/**
 * Truncation budget for anything read out of history.
 *
 * This is the whole reason `git_history` and `gh_thread` are tools rather than instructions to run
 * `git log` / `gh pr view` in the researcher's own shell — the rule in CLAUDE.md is to wrap a command
 * only when code must enforce something about it, and here it must. Squash-merge messages are not a
 * corner case: zio-blocks 7c49fb9, the commit that motivated these tools, carries a 1239-line message
 * (~60KB) explaining the whole design of `Async[A]`. That single message is larger than the rest of a
 * researcher's context put together, and `git log` on a core type returns ten of them.
 *
 * Head-and-tail rather than head-only: a squash message opens with the first sub-commit and closes
 * with the last, so both ends carry rationale while the middle is the most repetitive part.
 */
const BODY_HEAD = 3000;
const BODY_TAIL = 1000;
/** Across all commits in one `git_history` answer; newest keep their full body, older ones get cut. */
const TOTAL_BODY_BUDGET = 20_000;
const MAX_COMMITS = 10;
/** Per comment in a `gh_thread` answer — review comments are many and mostly short. */
const COMMENT_CHARS = 800;
const MAX_COMMENTS = 10;

/** Cut `text` to `head` + `tail` characters with an explicit marker, or return it unchanged. */
function clamp(text: string, head: number, tail = 0): string {
  const budget = head + tail;
  if (text.length <= budget) return text;
  const cut = text.length - budget;
  const marker = `\n… [truncated ${cut} chars] …\n`;
  return tail > 0 ? text.slice(0, head) + marker + text.slice(-tail) : text.slice(0, head) + marker;
}

/** PR numbers a commit subject names: the `(#N)` squash suffix and the merge-commit form. */
function prNumbersIn(subject: string): number[] {
  const found = new Set<number>();
  for (const m of subject.matchAll(/\(#(\d+)\)/g)) found.add(Number(m[1]));
  const merge = subject.match(/^Merge pull request #(\d+)/);
  if (merge) found.add(Number(merge[1]));
  return [...found];
}

const commitSchema = v.object({
  shortSha: v.string(),
  date: v.string(),
  author: v.string(),
  subject: v.string(),
  body: v.pipe(v.string(), v.description('The commit message body, truncated if long')),
  prNumbers: v.pipe(
    v.array(v.number()),
    v.description('PR numbers this commit names — pass one to gh_thread to read the discussion'),
  ),
});

// NUL between a commit's fields, RS between commits. A commit message can contain anything a
// printable delimiter could — including the `---` or `|` a naive format would split on — so the
// separators have to be bytes git will never emit from `%s` / `%b` itself.
const FIELD = '\x00';
const RECORD = '\x1e';
const GIT_FORMAT = '%H%x00%ad%x00%an%x00%s%x00%b%x1e';

/**
 * Read the commit history of specific source files.
 *
 * Path-driven rather than keyword-driven, deliberately: the researcher has just read a type's source
 * files, so asking "what was said about THESE files" beats guessing search terms, and it is the only
 * way to reach a rationale whose commit subject never mentions the type by name.
 *
 * `--follow` takes exactly one pathspec, so this runs once per path and merges. A path with no
 * history is reported in `note` instead of failing the call — the researcher passes several paths at
 * once and one bad one must not lose the others. Every path failing does throw.
 */
export function createGitHistoryTool(resolveRepoPath: () => string) {
  return defineTool({
    name: 'git_history',
    description:
      'Read the commit history of specific source files — subjects, message bodies, and the PR numbers they name. Commit messages are the densest source of design rationale in a repo.',
    input: v.object({
      paths: v.pipe(
        v.array(v.string()),
        v.description('Repo-relative source files to read the history of, e.g. ["src/main/scala/Lens.scala"]'),
      ),
      limit: v.optional(
        v.pipe(v.number(), v.description('Commits per path (default 10)')),
      ),
    }),
    output: v.object({
      commits: v.array(commitSchema),
      note: v.pipe(v.string(), v.description('What was truncated, skipped, or had no history')),
    }),
    async run({ data, signal }) {
      const repoPath = resolveRepoPath();
      const limit = Math.max(1, Math.min(data.limit ?? MAX_COMMITS, MAX_COMMITS));

      const bySha = new Map<string, v.InferOutput<typeof commitSchema> & { raw: string }>();
      const problems: string[] = [];

      for (const p of data.paths) {
        let stdout: string;
        try {
          ({ stdout } = await execFileAsync(
            'git',
            ['log', '--follow', '--date=short', `--format=${GIT_FORMAT}`, '-n', String(limit), '--', p],
            { cwd: repoPath, signal, maxBuffer: 64 * 1024 * 1024 },
          ));
        } catch (err) {
          problems.push(`${p}: ${(err as Error).message.split('\n')[0]}`);
          continue;
        }
        const records = stdout.split(RECORD).filter((r) => r.trim());
        if (!records.length) problems.push(`${p}: no commit history`);
        for (const record of records) {
          const [sha, date, author, subject, body] = record.replace(/^\n/, '').split(FIELD);
          if (!sha || bySha.has(sha)) continue;
          bySha.set(sha, {
            shortSha: sha.slice(0, 7),
            date: date ?? '',
            author: author ?? '',
            subject: subject ?? '',
            body: '',
            prNumbers: prNumbersIn(subject ?? ''),
            raw: (body ?? '').trim(),
          });
        }
      }

      if (!bySha.size) {
        throw new Error(
          `No commit history for any of: ${data.paths.join(', ')}. ${problems.join('; ')}. ` +
            `Check the paths are repo-relative and exist in this checkout.`,
        );
      }

      // Newest first, so the newest commits keep their full body when the shared budget runs out.
      const ordered = [...bySha.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_COMMITS);
      let spent = 0;
      const commits = ordered.map(({ raw, ...commit }) => {
        const remaining = TOTAL_BODY_BUDGET - spent;
        const body = remaining <= 0 ? clamp(raw, 200) : clamp(raw, Math.min(BODY_HEAD, remaining), BODY_TAIL);
        spent += body.length;
        return { ...commit, body };
      });

      const truncated = commits.filter((c) => c.body.includes('[truncated')).length;
      const note = [
        `${commits.length} commit(s) across ${data.paths.length} path(s).`,
        truncated ? `${truncated} message(s) truncated — re-read a commit in the shell if you need the rest.` : '',
        problems.length ? `Skipped: ${problems.join('; ')}.` : '',
      ]
        .filter(Boolean)
        .join(' ');

      return { output: { commits, note } };
    },
  });
}

/**
 * Read one GitHub PR or issue in full: body plus discussion.
 *
 * The hop `git_history` sets up — a commit subject ends in `(#N)`, and the PR body plus its review
 * discussion carry the argument the squash message only summarizes. For a PR the closing issue
 * numbers come back too, so the researcher can make the next hop itself rather than being walked
 * through a scripted chain.
 *
 * Complements `gh_query`, which finds threads by keyword but returns only titles.
 */
export function createGhThreadTool(resolveRepoPath: () => string) {
  return defineTool({
    name: 'gh_thread',
    description:
      'Read one GitHub PR or issue in full — title, body, and discussion — via the gh CLI. Use it on a PR number a commit named, or on an issue that PR closes.',
    input: v.object({
      kind: v.pipe(v.picklist(['pr', 'issue']), v.description('"pr" or "issue"')),
      number: v.pipe(v.number(), v.description('The PR or issue number, without the "#"')),
    }),
    output: v.object({
      title: v.string(),
      state: v.string(),
      url: v.string(),
      body: v.pipe(v.string(), v.description('The description, truncated if long')),
      comments: v.array(v.object({ author: v.string(), body: v.string() })),
      linkedIssues: v.pipe(
        v.array(v.number()),
        v.description('Issues this PR closes — pass one back to gh_thread as kind "issue"'),
      ),
      note: v.string(),
    }),
    async run({ data, signal }) {
      const repoPath = resolveRepoPath();
      const slug = await githubSlug(repoPath, signal);
      const fields = ['title', 'body', 'state', 'url', 'comments'];
      if (data.kind === 'pr') fields.push('closingIssuesReferences');
      // execFile rejects on non-zero exit, so a missing number or an unauthenticated gh surfaces as a
      // tool error rather than an empty-looking success — same contract as gh_query.
      const { stdout } = await execFileAsync(
        'gh',
        [data.kind, 'view', String(data.number), '--repo', slug, '--json', fields.join(',')],
        { cwd: repoPath, signal, maxBuffer: 16 * 1024 * 1024 },
      );
      const raw = JSON.parse(stdout) as {
        title?: string;
        body?: string;
        state?: string;
        url?: string;
        comments?: Array<{ author?: { login?: string }; body?: string }>;
        closingIssuesReferences?: Array<{ number: number }>;
      };

      const allComments = raw.comments ?? [];
      const comments = allComments.slice(0, MAX_COMMENTS).map((c) => ({
        author: c.author?.login ?? '(unknown)',
        body: clamp(c.body ?? '', COMMENT_CHARS),
      }));
      const dropped = allComments.length - comments.length;

      return {
        output: {
          title: raw.title ?? '',
          state: raw.state ?? '',
          url: raw.url ?? '',
          body: clamp(raw.body ?? '', BODY_HEAD, BODY_TAIL),
          comments,
          linkedIssues: (raw.closingIssuesReferences ?? []).map((i) => i.number),
          note: dropped > 0 ? `${dropped} further comment(s) not shown.` : '',
        },
      };
    },
  });
}
