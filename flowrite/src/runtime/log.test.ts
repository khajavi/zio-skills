// The log tag.
//
// Worth pinning because its only purpose is to be grepped. Every phase announcement flows through
// note(), and a run log interleaves those with sbt's identically formatted [info] lines — so the tag
// changing silently would not break a single behaviour, it would just make the greps in
// investigate-flowrite-log's instructions quietly return nothing.
import assert from 'node:assert/strict';
import test from 'node:test';

import { LOG_TAG, note } from './log.ts';

/** A FlueLogger that records instead of printing. */
function recorder() {
  const lines: string[] = [];
  return {
    lines,
    log: {
      info: (message: string) => void lines.push(message),
      warn: (message: string) => void lines.push(message),
      error: (message: string) => void lines.push(message),
    },
  };
}

test('every flowrite line carries the tag', () => {
  const { lines, log } = recorder();
  note(log, 'Researching data type: Iso');
  assert.deepEqual(lines, ['flowrite: Researching data type: Iso']);
});

test('the tag is what the documented grep looks for', () => {
  // `grep 'flowrite:'` is the instruction in the investigate-flowrite-log skill. If LOG_TAG were
  // renamed, that grep would return nothing and a reader would conclude the run logged no phases.
  assert.equal(LOG_TAG, 'flowrite');
  const { lines, log } = recorder();
  note(log, 'Writing data type reference: docs/reference/prism.md');
  assert.ok(
    lines.every((line) => line.includes(`${LOG_TAG}:`)),
    'a line without the tag is indistinguishable from sbt output',
  );
});

test('the tag survives a message that mentions sbt output', () => {
  // The confusable case: our own line quoting the build's wording. The tag has to come first, so the
  // line is attributable however the message reads.
  const { lines, log } = recorder();
  note(log, '[info] compiling 3 Scala sources — quoted from the build');
  assert.match(lines[0]!, /^flowrite: /);
});
