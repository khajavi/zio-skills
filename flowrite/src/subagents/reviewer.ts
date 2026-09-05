import { defineSubagent } from '@flue/runtime';
import { TIERS } from '../runtime/models.ts';
import { docKind } from '../runtime/run-context.ts';
import { checklistBlock, styleBlock } from '../runtime/kind-docs.ts';
import instructions from './reviewer.md';

/**
 * Generic documentation reviewer, shared across document kinds. Declares no tools or delegates of its
 * own, so it cannot re-enter the pipeline that called it.
 *
 * Reached with the built-in `task` tool now, like every other role — `review_page`, the harness tool
 * that used to hold this delegation's result in TypeScript for `recordedVerdict()`, is gone. The
 * kind's checklist and the writing-style rules move to this render for the same reason the drafter's
 * structure template does: `docKind()` is reachable here (run-context.ts's module holder exists for
 * exactly that), so the render can select the right checklist itself instead of a phase tool pasting
 * one into the prompt.
 *
 * Giving up the harness tool gives up more than its wiring: `report_run_result` can no longer derive
 * the run's verdict from a schema-validated result, so it goes back to asking the model for one. That
 * reopens a bug this repo fixed and measured three times over (tinytally turn1: a reviewer returned 14
 * failing items and the run still filed `passed`) — see self-report.ts for where the verdict is
 * self-reported again, and why.
 */
export function Reviewer() {
  const kind = docKind();
  return [instructions, ``, checklistBlock(kind), ``, styleBlock()].join('\n');
}

export const reviewer = defineSubagent({
  name: 'reviewer',
  ...TIERS.reviewer,
  description:
    'Evaluates a written documentation page against its document kind\'s checklist and the writing ' +
    'style rules, and reports per-item pass/fail in prose.',
  agent: Reviewer,
});
