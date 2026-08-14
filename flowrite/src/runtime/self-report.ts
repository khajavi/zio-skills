import { defineTool } from '@flue/runtime';
import * as v from 'valibot';

import { recordedVerdict } from '../tools/phases/review-page.ts';

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
 * What the run reports, and what it no longer gets to report.
 *
 * The verdict is not an input any more. It used to be a required `reviewVerdict` plus a
 * `failingItems` list, checked only for internal consistency — a "failed" verdict had to name
 * something. That check cannot catch the failure that actually happens, because a model reporting
 * `passed` with an empty list is perfectly self-consistent.
 *
 * tinytally turn1 is the measurement. The reviewer returned 14 items, every one `pass: false`. The
 * round budget then refused a confirming pass and told the model, in as many words, to file
 * `reviewVerdict "failed"` with those items. It filed `{"passed": true, "failingItems": []}`, and
 * `verdict.json` recorded that as the run's outcome — a reader would conclude the review passed 14
 * checks it had failed. Three runs of this defect are on record.
 *
 * So `report_run_result` now states the verdict from what the reviewer returned (see
 * `recordedVerdict()` in review-page.ts) instead of asking for it. The model keeps authorship of
 * everything only it can know — the summary and the retrospective — and loses authorship of the one
 * field there is independent evidence for. `claimedVerdict` survives as a diagnostic: it is recorded
 * nowhere and changes nothing, and exists so a divergence line can measure how often the claim and
 * the evidence disagree.
 */
const reportInput = v.object({
  path: v.pipe(v.string(), v.description('Repo-relative path of the finished page')),
  claimedVerdict: v.pipe(
    v.optional(v.picklist(['passed', 'failed', 'not-reviewed'])),
    v.description(
      'What you believe the review concluded. The recorded verdict comes from the review itself, ' +
        'so this only notes your reading of it; a disagreement is logged, not resolved in either ' +
        'direction.',
    ),
  ),
  summary: v.pipe(
    v.string(),
    v.description(
      'One line: what was produced. When the review found failures, say so here and name what is ' +
        'still wrong — do not describe a failing page as complete.',
    ),
  ),
  insights: insightsSchema,
});

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
      const { verdict, failingItems } = recordedVerdict();
      const passed = verdict === 'not-reviewed' ? null : verdict === 'passed';

      console.error(`${label} run summary: ${data.path} — ${data.summary}`);
      // Its own line, parsed into verdict.json by archive-docs.sh, so a run's pass/fail survives in
      // the archive as one field rather than as a sentence someone has to interpret. The shape is
      // unchanged — {passed, failingItems} — because scripts/run-report.mjs reads exactly those two
      // keys; only where the values come from changed.
      console.error(`${label} run verdict: ${JSON.stringify({ passed, failingItems })}`);
      console.error(`${label} run insights: ${JSON.stringify(data.insights)}`);

      // Diagnostic only. Measures the defect that motivated deriving the verdict, which is worth
      // counting across runs now that it can no longer mislead the archive.
      if (data.claimedVerdict !== undefined && data.claimedVerdict !== verdict) {
        console.error(
          `${label} verdict divergence: the run claimed "${data.claimedVerdict}" and the review ` +
            `recorded "${verdict}"${failingItems.length > 0 ? ` (${failingItems.length} failing item(s))` : ''}`,
        );
      }

      // Echoed back so the recorded facts — not the claimed ones — are in front of the model as it
      // writes its closing reply.
      return { output: { recorded: true, reviewPassed: passed, failingItems } };
    },
  });
}
