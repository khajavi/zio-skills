// What `git_history` returns for real commits in a real repository.
//
// Worth testing because every failure mode here is silent. A commit message can contain any
// printable character, so a mis-chosen delimiter splits a message mid-sentence and the researcher
// reads a truncated rationale as if it were whole. And the truncation budget is the entire reason
// this is a tool rather than an instruction to run `git log`: zio-blocks 7c49fb9 carries a 1239-line
// message, so a budget that quietly stops applying would blow the researcher's context on one call
// and show up only as a run that got expensive.
//
// Driven through the real `git log` rather than a stubbed stdout: the format string, `--follow` and
// the per-path loop are the parts that break, and a fake stdout would test none of them.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createGitHistoryTool } from './repo-tools.ts';

/** A commit body long enough to force truncation, in the shape a squash message really has. */
const HUGE_BODY = [
  'HEAD_MARKER — the first sub-commit, where a squash message states the main decision.',
  'x'.repeat(6000),
  'TAIL_MARKER — the last sub-commit, where a squash message states what it fixed.',
].join('\n\n');

/** A throwaway repository with the commits a test needs, newest last. */
function repoWith(commits: { message: string; files: Record<string, string> }[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'flowrite-history-'));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  git('init', '--quiet');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  git('config', 'commit.gpgsign', 'false');
  for (const commit of commits) {
    for (const [file, content] of Object.entries(commit.files)) {
      mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      writeFileSync(path.join(dir, file), content);
    }
    git('add', '-A');
    git('commit', '--quiet', '-m', commit.message);
  }
  return dir;
}

/** Run the tool against `dir`. The run body takes only `data`, so nothing else has to be supplied. */
async function history(dir: string, paths: string[], limit?: number) {
  const tool = createGitHistoryTool(() => dir);
  const result = (await (tool.run as (a: unknown) => Promise<unknown>)({ data: { paths, limit } })) as {
    output: {
      commits: { shortSha: string; subject: string; body: string; prNumbers: number[] }[];
      note: string;
    };
  };
  return result.output;
}

test('a squash message survives its delimiters and is cut to budget at both ends', async () => {
  const dir = repoWith([
    { message: `feat(async): zero-allocation Async[A] (#1496)\n\n${HUGE_BODY}`, files: { 'a.scala': 'a' } },
  ]);

  const { commits, note } = await history(dir, ['a.scala']);

  assert.equal(commits.length, 1);
  const [commit] = commits;
  assert.equal(commit.subject, 'feat(async): zero-allocation Async[A] (#1496)');
  assert.deepEqual(commit.prNumbers, [1496], 'the (#N) suffix is the hop to the PR discussion');
  // Both ends kept, the middle dropped, and the reader told so — the point of head-and-tail.
  assert.match(commit.body, /HEAD_MARKER/);
  assert.match(commit.body, /TAIL_MARKER/);
  assert.match(commit.body, /\[truncated \d+ chars\]/);
  assert.ok(commit.body.length < HUGE_BODY.length, 'a 6KB message must not come back whole');
  assert.match(note, /truncated/);
});

test('a subject with pipes and dashes is not split by them', async () => {
  // The delimiters are NUL and RS precisely so a message like this one cannot forge a field break.
  const subject = 'fix: reject `a | b` --- and keep the rest';
  const dir = repoWith([{ message: `${subject}\n\nbody line`, files: { 'a.scala': 'a' } }]);

  const { commits } = await history(dir, ['a.scala']);

  assert.equal(commits[0].subject, subject);
  assert.equal(commits[0].body, 'body line');
  assert.deepEqual(commits[0].prNumbers, []);
});

test('a commit reachable from two paths is reported once', async () => {
  const dir = repoWith([
    { message: 'chore: seed', files: { 'a.scala': 'a', 'b.scala': 'b' } },
    { message: 'feat: touch both (#7)', files: { 'a.scala': 'a2', 'b.scala': 'b2' } },
  ]);

  const { commits } = await history(dir, ['a.scala', 'b.scala']);

  const shas = commits.map((c) => c.shortSha);
  assert.deepEqual([...new Set(shas)], shas, 'the same commit must not be paid for twice');
  assert.equal(commits.filter((c) => c.subject === 'feat: touch both (#7)').length, 1);
});

test('one unreadable path is reported, not fatal', async () => {
  const dir = repoWith([{ message: 'chore: seed', files: { 'a.scala': 'a' } }]);

  const { commits, note } = await history(dir, ['a.scala', 'does/not/exist.scala']);

  assert.equal(commits.length, 1, 'the good path still answers');
  assert.match(note, /does\/not\/exist\.scala/, 'the bad one is named rather than silently dropped');
});

test('no history at all is an error, not an empty success', async () => {
  // A silent empty answer reads to the researcher as "this type has no rationale", which is the one
  // conclusion it must never draw from a broken call.
  const dir = repoWith([{ message: 'chore: seed', files: { 'a.scala': 'a' } }]);

  await assert.rejects(() => history(dir, ['nope.scala']), /No commit history/);
});

test('a merge commit names its PR', async () => {
  const dir = repoWith([
    { message: 'Merge pull request #50 from khajavi/fix-thing', files: { 'a.scala': 'a' } },
  ]);

  const { commits } = await history(dir, ['a.scala']);

  assert.deepEqual(commits[0].prNumbers, [50]);
});
