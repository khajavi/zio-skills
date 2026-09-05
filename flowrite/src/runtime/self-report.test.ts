// What report_run_result records, now that the verdict is self-reported again.
//
// `review_page` and `fact_check_page` — the harness tools that used to hold a schema-validated
// verdict in TypeScript for `recordedVerdict()` to derive from — are retired: `reviewer` and
// `fact_checker` are ordinary subagents reached with `task` now, and a `task` delegation returns
// prose that nothing can validate. So the model reports its own verdict again, same as it did before
// d700d2b6/e93719ac fixed the three measured cases where that claim diverged from the evidence
// (tinytally turn1's exact inversion chief among them — see self-report.ts's docstring).
//
// These tests pin the restored contract: the schema requires `reviewVerdict` and `failingItems`, a
// "failed" verdict with no failing items is logged as suspicious (not rejected — there is no
// evidence to check it against any more), and the verdict line keeps its `{passed, failingItems}`
// shape for `scripts/run-report.mjs`.
import assert from 'node:assert/strict';
import test from 'node:test';
import * as v from 'valibot';

import { createReportRunResultTool } from './self-report.ts';

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
      reviewVerdict: 'passed',
      failingItems: [],
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
    reviewVerdict: 'passed',
    failingItems: [],
    summary: 'A Prism reference page.',
    insights: [],
    ...over,
  });

test('a passing verdict with no failing items records a pass', async () => {
  const result = await run();
  assert.equal(result.output.recorded, true);
  assert.equal(result.output.reviewPassed, true);
  assert.deepEqual(result.output.failingItems, []);
});

test('a failed verdict records the named failing items', async () => {
  const result = await run({
    reviewVerdict: 'failed',
    failingItems: ['writing-style rule 8', 'fact-check (high/contradicted): wrong return type'],
  });
  assert.equal(result.output.reviewPassed, false);
  assert.deepEqual(result.output.failingItems, [
    'writing-style rule 8',
    'fact-check (high/contradicted): wrong return type',
  ]);
});

test('not-reviewed records a null verdict, distinct from a pass or a fail', async () => {
  const result = await run({ reviewVerdict: 'not-reviewed', failingItems: [] });
  assert.equal(result.output.reviewPassed, null);
});

test('reviewVerdict and failingItems are required — there is no default to fall back on', () => {
  assert.equal(parse({ reviewVerdict: undefined }).success, false);
  assert.equal(parse({ failingItems: undefined }).success, false);
});

test('reviewVerdict only accepts the three known states', () => {
  assert.equal(parse({ reviewVerdict: 'passing' }).success, false);
  assert.equal(parse({ reviewVerdict: 'passed' }).success, true);
  assert.equal(parse({ reviewVerdict: 'failed', failingItems: ['x'] }).success, true);
  assert.equal(parse({ reviewVerdict: 'not-reviewed' }).success, true);
});

test('the path, summary and retrospective are still required of the model', () => {
  assert.equal(parse({ summary: undefined }).success, false);
  assert.equal(parse({ path: undefined }).success, false);
  assert.equal(parse({ insights: undefined }).success, false);
});
