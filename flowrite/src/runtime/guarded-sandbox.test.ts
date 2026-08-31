// stripRedundantCdIntoCwd is the pure decision behind the guarded bash tool: which commands get
// rewritten, and — just as important — which ones must pass through byte-for-byte because they cd
// somewhere that actually matters.
import assert from 'node:assert/strict';
import test from 'node:test';

import { stripRedundantCdIntoCwd } from './guarded-sandbox.ts';

const CWD = '/home/milad/sources/scala/zio-worktrees/migrate-cats-effect';

test('strips an unquoted cd-into-cwd prefix before &&', () => {
  assert.equal(
    stripRedundantCdIntoCwd(`cd ${CWD} && sbt compile`, CWD),
    'sbt compile',
  );
});

test('strips a double-quoted cd-into-cwd prefix', () => {
  assert.equal(
    stripRedundantCdIntoCwd(`cd "${CWD}" && sbt compile`, CWD),
    'sbt compile',
  );
});

test('strips a single-quoted cd-into-cwd prefix', () => {
  assert.equal(
    stripRedundantCdIntoCwd(`cd '${CWD}' && sbt compile`, CWD),
    'sbt compile',
  );
});

test('strips before a semicolon, not only before &&', () => {
  assert.equal(stripRedundantCdIntoCwd(`cd ${CWD}; ls`, CWD), 'ls');
});

test('tolerates a trailing slash on the cwd', () => {
  assert.equal(stripRedundantCdIntoCwd(`cd ${CWD}/ && ls`, CWD), 'ls');
});

test('tolerates leading whitespace before cd', () => {
  assert.equal(stripRedundantCdIntoCwd(`  cd ${CWD} && ls`, CWD), 'ls');
});

test('leaves a cd into a subdirectory untouched — that is a real directory change', () => {
  const command = `cd ${CWD}/website && yarn build`;
  assert.equal(stripRedundantCdIntoCwd(command, CWD), command);
});

test('leaves a cd that is not the command\'s first token untouched', () => {
  const command = `echo start && cd ${CWD} && ls`;
  assert.equal(stripRedundantCdIntoCwd(command, CWD), command);
});

test('leaves a command with no cd untouched', () => {
  const command = 'sbt "docs/mdoc --in docs/guides/x.md --out website/docs/guides/x.md"';
  assert.equal(stripRedundantCdIntoCwd(command, CWD), command);
});

test('leaves a cd to an unrelated path untouched, even one that starts the same', () => {
  const command = `cd ${CWD}-other && ls`;
  assert.equal(stripRedundantCdIntoCwd(command, CWD), command);
});

test('a cwd containing regex-special characters is matched literally', () => {
  const cwd = '/tmp/repo (copy)';
  assert.equal(stripRedundantCdIntoCwd(`cd ${cwd} && ls`, cwd), 'ls');
});
