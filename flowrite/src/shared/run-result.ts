import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { insightsSchema } from './schemas.ts';

/**
 * The end-of-run report every docs writer files: where the page landed, what it did,
 * and the run retrospective.
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
export function createReportRunResultTool(label: string) {
  return defineTool({
    name: 'report_run_result',
    description:
      'File the end-of-run report: the finished page path, a one-line summary, and the run ' +
      'retrospective. Call this once, last, after the page is written and reviewed.',
    input: v.object({
      path: v.pipe(v.string(), v.description('Repo-relative path of the finished page')),
      summary: v.pipe(v.string(), v.description('One line: what was produced')),
      insights: insightsSchema,
    }),
    output: v.object({ recorded: v.boolean() }),
    run({ data }) {
      console.error(`${label} run summary: ${data.path} — ${data.summary}`);
      console.error(`${label} run insights: ${JSON.stringify(data.insights)}`);
      return { output: { recorded: true } };
    },
  });
}
