import { defineTool } from '@flue/runtime';
import * as v from 'valibot';

/**
 * A self-authored run retrospective: the obstacles the agent actually hit and how it got past them,
 * so recurring friction can be mined across runs (each turn's insights.json in the archive) to drive
 * instruction and tool improvements. Phases are listed in run order.
 *
 * Lives here because `report_run_result` is the only thing that collects it.
 */
const insightsSchema = v.array(
  v.object({
    phase: v.picklist(['research', 'design', 'write', 'examples', 'mdoc', 'integrate', 'review']),
    obstacle: v.pipe(v.string(), v.description('What actually went wrong or slowed you down this run')),
    resolution: v.pipe(v.string(), v.description('How you got past it')),
    suggestedFix: v.nullable(
      v.pipe(
        v.string(),
        v.description('A concrete instruction/tool/schema change that would prevent this next time, or null'),
      ),
    ),
  }),
);

/**
 * The end-of-run report every docs writer files: where the page landed, what it did, the review's
 * verdict, and the run retrospective.
 *
 * The MODEL's account of the run, authored by it and taken on trust. Its counterpart is
 * run-telemetry.ts, which reports the same run from the event stream — observed, not claimed. That
 * split is the reason these are two modules: nothing here may be fed from telemetry and nothing
 * there may be fed from here, or the archive stops being able to disagree with itself.
 *
 * This existed as the deleted workflow's `outputSchema`, collected by a closing
 * `session.prompt(..., { result })` and logged as three lines. Losing the workflow
 * lost the retrospective with it: `scripts/archive-docs.sh` parses a
 * `<label> run insights: <json>` line into `insights.json`, and that line stopped
 * being emitted, so run friction silently stopped being captured across turns —
 * which is the whole point of archiving it.
 *
 * A model-callable tool rather than a hook, because only the model can author the
 * retrospective. The shared run directive tells it to call this last.
 *
 * Logged with `console.error`, not `log.info`: the CLI printer renders a tool's
 * logger output where the archive script cannot see it, while stderr lands in the
 * captured run log next to the token-usage line the same script already parses.
 * Stdout stays reserved for the reply so `--json` keeps parsing.
 */

/**
 * What the model reports the review concluded.
 *
 * Self-reported. It used to be checked against a recorded verdict, which caught two runs filing
 * "Complete Prism reference page with … working mdoc examples (0 errors)" over a review that had
 * returned `passed: false` with two named writing-style failures. That recorded verdict is gone by
 * direction, so what remains is the report's own internal consistency: a "failed" verdict has to name
 * what failed. That does not judge the page — it only stops the archive recording a failure with
 * nothing in it.
 */
const reportInput = v.pipe(
  v.object({
    path: v.pipe(v.string(), v.description('Repo-relative path of the finished page')),
    reviewVerdict: v.pipe(
      v.picklist(['passed', 'failed', 'not-reviewed']),
      v.description(
        'What the review concluded: "passed" only when every checklist item passed, "failed" when ' +
          'any item still fails, "not-reviewed" when no review ran.',
      ),
    ),
    failingItems: v.pipe(
      v.optional(v.array(v.string()), []),
      v.description(
        'The review items that still fail, by name (e.g. "writing-style rule 7 @ line 402"). ' +
          'Required when reviewVerdict is "failed"; omit otherwise.',
      ),
    ),
    summary: v.pipe(
      v.string(),
      v.description(
        'One line: what was produced. When the review failed, say so here and name what is ' +
          'still wrong — do not describe a failing page as complete.',
      ),
    ),
    insights: insightsSchema,
  }),
  v.check(
    (r) => r.reviewVerdict !== 'failed' || r.failingItems.length > 0,
    'reviewVerdict is "failed" but failingItems is empty. File the report again listing every ' +
      'review item that still fails, and name them in your summary and your reply too — do not ' +
      'describe a failing page as complete.',
  ),
);

export function createReportRunResultTool(label: string) {
  return defineTool({
    name: 'report_run_result',
    description:
      'File the end-of-run report: the finished page path, the review verdict, a one-line summary, ' +
      'and the run retrospective. Call this once, last, after the page is written and reviewed.',
    input: reportInput,
    output: v.object({
      recorded: v.boolean(),
      reviewPassed: v.nullable(v.boolean()),
      failingItems: v.array(v.string()),
    }),
    run({ data }) {
      const passed = data.reviewVerdict === 'not-reviewed' ? null : data.reviewVerdict === 'passed';
      const failingItems = data.failingItems;

      console.error(`${label} run summary: ${data.path} — ${data.summary}`);
      // Its own line, parsed into verdict.json by archive-docs.sh, so a run's pass/fail survives in
      // the archive as one field rather than as a sentence someone has to interpret. It is the
      // model's own account now, not an independent record — read it as such when comparing turns.
      console.error(`${label} run verdict: ${JSON.stringify({ passed, failingItems })}`);
      console.error(`${label} run insights: ${JSON.stringify(data.insights)}`);

      // Echoed back so the facts are in front of the model as it writes its closing reply.
      return { output: { recorded: true, reviewPassed: passed, failingItems } };
    },
  });
}
