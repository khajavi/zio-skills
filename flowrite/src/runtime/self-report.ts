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
    phase: v.picklist([
      'research',
      'design',
      'write',
      'examples',
      'mdoc',
      'fact-check',
      'integrate',
      'review',
      'fix',
    ]),
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
 */

/**
 * The verdict is self-reported again, on explicit instruction, after `review_page` and
 * `fact_check_page` — the harness tools that used to hold it — were retired.
 *
 * This reopens a bug this repo fixed and measured three times over. tinytally turn1: the reviewer
 * returned 14 items, every one `pass: false`. The round budget refused a confirming pass and told the
 * model, in as many words, to file `reviewVerdict "failed"` with those items. It filed
 * `{"passed": true, "failingItems": []}` instead — the exact inverse — and that became the run's
 * recorded outcome. write-module-ref-turn4 is the second: it fixed 5 of 6 flagged items, then wrote
 * "production-ready and passes all technical verification" in prose.
 *
 * The fix at the time (d700d2b6, e93719ac) was to derive the verdict from `recordedVerdict()` — data
 * a harness tool held in TypeScript, from a schema-validated subagent result — so the model could no
 * longer claim a verdict independent of the evidence. Removing the harness tools removes the thing
 * that made that derivation possible: `reviewer` and `fact_checker` are ordinary subagents reached
 * with `task` now, like every other role, and a `task` delegation returns prose that nothing can
 * validate. There is no way to hold both "no harness tool" and "a verdict TypeScript can vouch for" —
 * this module now has neither, and the tradeoff is deliberate, not an oversight: read the reply
 * honestly and report what it said, same as every other phase's summary already has to.
 *
 * The verdict line keeps its `{passed, failingItems}` shape because `scripts/run-report.mjs` reads
 * exactly those keys; only where the values come from changed back.
 */
const reportInput = v.object({
  path: v.pipe(v.string(), v.description('Repo-relative path of the finished page')),
  reviewVerdict: v.pipe(
    v.picklist(['passed', 'failed', 'not-reviewed']),
    v.description(
      'What the review and fact-check delegations actually concluded, read honestly from their ' +
        'replies. "passed" only when every checklist item passed AND fact-check reported no ' +
        'high/medium drift. "not-reviewed" when review was skipped or never delegated — never ' +
        'report "passed" for a page nothing checked.',
    ),
  ),
  failingItems: v.pipe(
    v.array(v.string()),
    v.description(
      'Every checklist item, writing-style rule, or fact-check drift still outstanding. Required ' +
        'and non-empty whenever reviewVerdict is "failed" — a failed verdict that names nothing is ' +
        'not trustworthy.',
    ),
  ),
  summary: v.pipe(
    v.string(),
    v.description(
      'One line: what was produced. When review or fact-check found failures, say so here and name ' +
        'what is still wrong — do not describe a failing page as complete.',
    ),
  ),
  insights: insightsSchema,
});

export function createReportRunResultTool(label: string) {
  return defineTool({
    name: 'report_run_result',
    description:
      'File the end-of-run report: the finished page path, the review verdict, a one-line summary, ' +
      'and the run retrospective. Call this once, last, after the page is written, fact-checked and ' +
      'reviewed. Report the verdict honestly — it is not checked against anything.',
    input: reportInput,
    output: v.object({
      recorded: v.boolean(),
      reviewPassed: v.nullable(v.boolean()),
      failingItems: v.array(v.string()),
    }),
    run({ data }) {
      const passed = data.reviewVerdict === 'not-reviewed' ? null : data.reviewVerdict === 'passed';

      console.error(`${label} run summary: ${data.path} — ${data.summary}`);
      // Its own line, parsed into verdict.json by archive-docs.sh — scripts/run-report.mjs reads
      // exactly these two keys.
      console.error(`${label} run verdict: ${JSON.stringify({ passed, failingItems: data.failingItems })}`);
      console.error(`${label} run insights: ${JSON.stringify(data.insights)}`);

      if (passed === false && data.failingItems.length === 0) {
        console.error(
          `${label} verdict warning: reviewVerdict "failed" named no failing items — a failed ` +
            `verdict with nothing to point at is exactly the shape this field cannot be checked against.`,
        );
      }

      return { output: { recorded: true, reviewPassed: passed, failingItems: data.failingItems } };
    },
  });
}
