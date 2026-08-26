// One case per gate in `classifyDocsRequirement`, in gate-table order — a transcription slip from the
// spec (docs-list-undocumented-prs' Phase 3 tables) into TypeScript is exactly the kind of silent
// misclassification this tool exists to prevent, so each gate gets a case, not just the happy paths.
import assert from 'node:assert/strict';
import test from 'node:test';

import { type PrFile, classifyDocsRequirement } from './classify-pr-docs.ts';

const file = (path: string, status: PrFile['status'] = 'added'): PrFile => ({ path, status });

test('OVERRIDE-BREAKING fires on a `!:` title regardless of everything else', () => {
  const result = classifyDocsRequirement({
    title: 'fix!: change default retry policy',
    labels: ['bug'],
    files: [file('src/main/scala/zio/Retry.scala', 'modified')],
  });
  assert.equal(result.gate, 'OVERRIDE-BREAKING');
  assert.equal(result.requiresDocs, 'yes');
});

test('OVERRIDE-DOCS-NEEDED fires on the label alone', () => {
  const result = classifyDocsRequirement({
    title: 'chore: tidy internal helper',
    labels: ['documentation-needed'],
    files: [file('src/main/scala/zio/internal/Helper.scala', 'modified')],
  });
  assert.equal(result.gate, 'OVERRIDE-DOCS-NEEDED');
  assert.equal(result.requiresDocs, 'yes');
});

test('NO-1: dependency bump title', () => {
  const result = classifyDocsRequirement({
    title: 'Bump zio to v2.1.0',
    labels: [],
    files: [file('build.sbt', 'modified')],
  });
  assert.equal(result.gate, 'NO-1');
  assert.equal(result.requiresDocs, 'no');
});

test('NO-1: renovate label', () => {
  const result = classifyDocsRequirement({
    title: 'update dependency zio-json',
    labels: ['renovate'],
    files: [file('build.sbt', 'modified')],
  });
  assert.equal(result.gate, 'NO-1');
});

test('NO-2: CI-only change with ci label', () => {
  const result = classifyDocsRequirement({
    title: 'ci: cache sbt between jobs',
    labels: ['ci'],
    files: [file('.github/workflows/build.yml', 'modified')],
  });
  assert.equal(result.gate, 'NO-2');
});

test('NO-3: test-only change', () => {
  const result = classifyDocsRequirement({
    title: 'add regression test for Chunk.zip',
    labels: [],
    files: [file('src/test/scala/zio/ChunkSpec.scala', 'modified')],
  });
  assert.equal(result.gate, 'NO-3');
});

test('NO-4: fix prefix, no new public files', () => {
  const result = classifyDocsRequirement({
    title: 'fix: correct off-by-one in Chunk.slice',
    labels: [],
    files: [file('src/main/scala/zio/Chunk.scala', 'modified')],
  });
  assert.equal(result.gate, 'NO-4');
});

test('NO-5: chore prefix, no new public files', () => {
  const result = classifyDocsRequirement({
    title: 'refactor: extract private helper in Chunk',
    labels: [],
    files: [file('src/main/scala/zio/Chunk.scala', 'modified')],
  });
  assert.equal(result.gate, 'NO-5');
});

test('NO-6: internal-only refactor with corroborating label', () => {
  const result = classifyDocsRequirement({
    title: 'reshape internal fiber runtime',
    labels: ['internal'],
    files: [file('src/main/scala/zio/internal/FiberRuntime.scala', 'modified')],
  });
  assert.equal(result.gate, 'NO-6');
});

test('NO-7: bug-fix label, no new public files, no feature label', () => {
  const result = classifyDocsRequirement({
    title: 'correct retry backoff calculation',
    labels: ['bug'],
    files: [file('src/main/scala/zio/Schedule.scala', 'modified')],
  });
  assert.equal(result.gate, 'NO-7');
});

test('NO-8: chore label, no public source changes', () => {
  const result = classifyDocsRequirement({
    title: 'update contributing guide',
    labels: ['chore'],
    // Plain doc file: not test/infra/build (so NO-3 does not also match this fixture) and not scala
    // (so filesPublicMain stays empty) — isolates NO-8 from the gates ranked ahead of it.
    files: [file('CONTRIBUTING.md', 'modified')],
  });
  assert.equal(result.gate, 'NO-8');
});

test('NO-9: revert commit', () => {
  const result = classifyDocsRequirement({
    title: 'Revert "feat: add ZStream.throttle"',
    labels: [],
    files: [file('src/main/scala/zio/stream/ZStream.scala', 'removed')],
  });
  assert.equal(result.gate, 'NO-9');
});

test('YES-1: feat prefix', () => {
  const result = classifyDocsRequirement({
    title: 'feat: add ZStream.debounce',
    labels: [],
    files: [file('src/main/scala/zio/stream/ZStream.scala', 'modified')],
  });
  assert.equal(result.gate, 'YES-1');
  assert.equal(result.requiresDocs, 'yes');
});

test('YES-2: new public source file', () => {
  const result = classifyDocsRequirement({
    title: 'add XML codec support',
    labels: [],
    files: [file('src/main/scala/zio/schema/codec/XmlCodec.scala', 'added')],
  });
  assert.equal(result.gate, 'YES-2');
  assert.match(result.reason, /XmlCodec\.scala/);
});

test('YES-3: breaking-change label', () => {
  const result = classifyDocsRequirement({
    title: 'rework Schema derivation internals',
    labels: ['breaking-change'],
    files: [file('src/main/scala/zio/schema/Schema.scala', 'modified')],
  });
  assert.equal(result.gate, 'YES-3');
});

test('YES-4: feature label with source changes', () => {
  const result = classifyDocsRequirement({
    title: 'extend Chunk with a new combinator',
    labels: ['enhancement'],
    files: [file('src/main/scala/zio/Chunk.scala', 'modified')],
  });
  assert.equal(result.gate, 'YES-4');
});

test('YES-5: interface-change language, whole word only', () => {
  const result = classifyDocsRequirement({
    title: 'Deprecate ZIO.effect in favor of ZIO.attempt',
    labels: [],
    files: [file('src/main/scala/zio/ZIO.scala', 'modified')],
  });
  assert.equal(result.gate, 'YES-5');
});

test('YES-5 does not fire on a substring match ("add" inside "added")', () => {
  const result = classifyDocsRequirement({
    title: 'chore: added test for Chunk',
    labels: [],
    files: [file('src/main/scala/zio/Chunk.scala', 'modified')],
  });
  // "added" must not satisfy the whole-word match for "add" (which isn't even one of the YES-5
  // words), and this case also has no new public file — falls through NO-5 (chore, no new public).
  assert.notEqual(result.gate, 'YES-5');
});

test('UNCERTAIN when no gate fires', () => {
  const result = classifyDocsRequirement({
    title: 'improve Chunk performance',
    labels: [],
    files: [
      file('src/main/scala/zio/Chunk.scala', 'modified'),
      file('src/test/scala/zio/ChunkSpec.scala', 'modified'),
    ],
  });
  assert.equal(result.gate, 'UNCERTAIN');
  assert.equal(result.requiresDocs, 'uncertain');
  assert.match(result.reason, /Observed:/);
});

test('gate order: NO gates are checked before YES gates', () => {
  // fix: prefix (NO-4 territory) on a PR that also adds a new public file (YES-2 territory) — YES-2
  // must win, because NO-4's own condition requires filesNewPublicMain to be empty, so it never
  // actually fires here; this pins that the two do not accidentally trade places.
  const result = classifyDocsRequirement({
    title: 'fix: add missing null check',
    labels: [],
    files: [file('src/main/scala/zio/NewGuard.scala', 'added')],
  });
  assert.equal(result.gate, 'YES-2');
});
