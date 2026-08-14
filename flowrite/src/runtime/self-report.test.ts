// What report_run_result records, now that the verdict is derived rather than reported.
//
// The tests this replaces asserted the old contract: the model supplied `reviewVerdict` and
// `failingItems`, and the only guard was internal consistency — a "failed" verdict had to name
// something. Every one of them passed while the defect they were meant to prevent kept shipping,
// because the failure is self-consistent: `passed` with an empty list satisfies that check perfectly.
//
// tinytally turn1 is the measurement. The reviewer returned 14 items, all `pass: false`; the round
// budget refused a confirming pass and told the model to file "failed" with those items; it filed
// `{"passed": true, "failingItems": []}`. Three runs of this are on record.
//
// So these tests assert the property that actually matters: what the run CLAIMS cannot change what
// gets recorded.
import assert from 'node:assert/strict';
import test from 'node:test';
import * as v from 'valibot';

import { createReportRunResultTool } from './self-report.ts';
import { __resetLastReviewForTests, __setLastReviewForTests } from '../tools/phases/review-page.ts';

const tool = createReportRunResultTool('write-data-type-ref');

/**
 * Call the tool with an otherwise-valid report.
 *
 * `run` is invoked through an `unknown` signature because a real ToolContext carries a harness,
 * sandbox and logger that this tool never touches — constructing one would be fabricating a runtime
 * to test a handful of lines.
 */
const run = (over: Record<string, unknown> = {}) =>
  (tool.run as (arg: unknown) => unknown)({
    data: {
      path: 'docs/reference/prism.md',
      summary: 'A Prism reference page.',
      insights: [],
      ...over,
    },
  }) as Promise<{
    output: { recorded: boolean; reviewPassed: boolean | null; failingItems: string[] };
  }>;

/** Validate a candidate input against the tool's own schema, the way the runtime does. */
const parse = (over: Record<string, unknown> = {}) =>
  v.safeParse(tool.input as v.GenericSchema, {
    path: 'docs/reference/prism.md',
    summary: 'A Prism reference page.',
    insights: [],
    ...over,
  });

/** A review result carrying `failing` failures among `total` items. */
const review = (total: number, failing: number) => ({
  state: 'reviewed' as const,
  items: Array.from({ length: total }, (_, i) => ({
    item: `checklist item ${i + 1}`,
    pass: i >= failing,
    issue: i < failing ? 'something is wrong' : null,
  })),
});

test('a review with every item passing records a pass', async () => {
  __resetLastReviewForTests();
  __setLastReviewForTests(review(5, 0));

  const result = await run();
  assert.equal(result.output.recorded, true);
  assert.equal(result.output.reviewPassed, true);
  assert.deepEqual(result.output.failingItems, []);
});

test('a review with failures records them, whatever the run claims', async () => {
  // turn1's exact shape: 14 items, all failing, and a run claiming it passed. The claim is the
  // regression — before this change it became the archived verdict.
  __resetLastReviewForTests();
  __setLastReviewForTests(review(14, 14));

  const result = await run({ claimedVerdict: 'passed' });

  assert.equal(result.output.reviewPassed, false);
  assert.equal(result.output.failingItems.length, 14);
  assert.equal(result.output.failingItems[0], 'checklist item 1');
});

test('no review at all reports a null verdict rather than a false one', async () => {
  // null and false are different facts: nothing checked the page, versus something checked it and
  // found problems. The archive distinguishes them, so the tool must not collapse them.
  __resetLastReviewForTests();

  const result = await run();
  assert.equal(result.output.reviewPassed, null);
  assert.deepEqual(result.output.failingItems, []);
});

test('a skipped review is not a pass', async () => {
  // Skipping produces no evidence about the page, so it reports as not-reviewed. A resumed run must
  // not inherit a pass it never earned.
  __resetLastReviewForTests();
  __setLastReviewForTests({ state: 'skipped' });

  const result = await run({ claimedVerdict: 'passed' });
  assert.equal(result.output.reviewPassed, null);
});

test('a run cannot report a verdict at all', () => {
  // The strongest form of the fix: the fields are gone, so the failure mode is unreachable rather
  // than guarded. valibot's default object schema drops unknown keys, so these are not merely
  // ignored at runtime — there is nowhere for them to land.
  const parsed = parse({ reviewVerdict: 'passed', failingItems: [] });
  assert.equal(parsed.success, true);
  const output = parsed.output as Record<string, unknown>;
  assert.equal('reviewVerdict' in output, false);
  assert.equal('failingItems' in output, false);
});

test('claimedVerdict is optional, so a report need not offer one', () => {
  assert.equal(parse().success, true);
  assert.equal(parse({ claimedVerdict: 'failed' }).success, true);
});

test('the path, summary and retrospective are still required of the model', () => {
  // Only the verdict moved to evidence. Everything only the model can know stays its job.
  assert.equal(parse({ summary: undefined }).success, false);
  assert.equal(parse({ path: undefined }).success, false);
  assert.equal(parse({ insights: undefined }).success, false);
});
