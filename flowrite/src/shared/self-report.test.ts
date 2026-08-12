// What report_run_result still guarantees, now that the verdict is self-reported.
//
// It used to check the model's claimed verdict against a recorded one, because the prose instruction
// alone was measured failing twice: told to "report the review's actual verdict … do not describe a
// failing page as passing", the writer filed "Complete Prism reference page with … working mdoc
// examples (0 errors)" over a review that had returned `passed: false` with two named writing-style
// failures — once before the three writers were merged and once after. That recorded verdict is gone
// by direction, and with it the ability to catch that case. What is left is the report's internal
// consistency: a "failed" verdict must name what failed, so the archive cannot record an empty
// failure.
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
const run = (over: Record<string, unknown>) =>
  (tool.run as (arg: unknown) => unknown)({
    data: {
      path: 'docs/reference/prism.md',
      summary: 'A Prism reference page.',
      failingItems: [],
      insights: [],
      ...over,
    },
  });

/** Validate a candidate input against the tool's own schema, the way the runtime does. */
const parse = (over: Record<string, unknown>) =>
  v.safeParse(tool.input as v.GenericSchema, {
    path: 'docs/reference/prism.md',
    summary: 'A Prism reference page.',
    insights: [],
    ...over,
  });

test('a passing report is recorded and echoes the verdict back', async () => {
  const result = (await run({ reviewVerdict: 'passed' })) as {
    output: { recorded: boolean; reviewPassed: boolean | null; failingItems: string[] };
  };
  assert.equal(result.output.recorded, true);
  assert.equal(result.output.reviewPassed, true);
  assert.deepEqual(result.output.failingItems, []);
});

test('a failing report carries its failing items through', async () => {
  const failingItems = ['writing-style rule 7 @ line 402'];
  const result = (await run({ reviewVerdict: 'failed', failingItems })) as {
    output: { reviewPassed: boolean | null; failingItems: string[] };
  };
  assert.equal(result.output.reviewPassed, false);
  assert.deepEqual(result.output.failingItems, failingItems);
});

test('"not-reviewed" reports a null verdict rather than a false one', async () => {
  // null and false are different facts: nothing checked the page, versus something checked it and
  // found problems. The archive distinguishes them, so the tool must not collapse them.
  const result = (await run({ reviewVerdict: 'not-reviewed' })) as {
    output: { reviewPassed: boolean | null };
  };
  assert.equal(result.output.reviewPassed, null);
});

test('"failed" with no failing items is rejected, and the error says how to refile', () => {
  const result = parse({ reviewVerdict: 'failed' });
  assert.equal(result.success, false);
  // The message is the retry prompt — the model has to be able to refile correctly from it alone.
  assert.match(result.issues![0].message, /failingItems is empty/);
  assert.match(result.issues![0].message, /File the report again/);
});

test('"failed" with named items validates', () => {
  assert.equal(parse({ reviewVerdict: 'failed', failingItems: ['writing-style rule 7'] }).success, true);
});

test('failingItems defaults to empty, so a passing report need not send it', () => {
  const result = parse({ reviewVerdict: 'passed' });
  assert.equal(result.success, true);
  assert.deepEqual((result.output as { failingItems: string[] }).failingItems, []);
});
