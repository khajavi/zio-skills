import { defineSubagent } from '@flue/runtime';
import { TIERS } from '../runtime/models.ts';
import { docKind } from '../runtime/run-context.ts';
import { checklistBlock, styleBlock } from '../runtime/kind-docs.ts';
import instructions from './reviewer.md';

/**
 * Generic documentation quality-checker, shared across document kinds. Declares no tools or
 * delegates of its own, so it cannot re-enter the pipeline that called it.
 *
 * Covers two jobs under one identity: a full-page check against the checklist and writing-style
 * rules, and a fact-check of one section (or a small batch) against the library source. They used to
 * be two subagents (`reviewer` and `fact_checker`); merged into one on explicit instruction, since a
 * checker's IDENTITY doesn't need to differ by job — only the payload a given call carries does (a
 * fact-check call still gets one section at a time, for the same context-budget reason as before).
 * `reviewer.md` opens with a "which job is this call" branch so the two stay behaviorally distinct
 * despite sharing a name/tier/render.
 *
 * Reached with the built-in `task` tool, like every other role. The kind's checklist and the
 * writing-style rules are read HERE, at this render, for the same reason the drafter's structure
 * template is: `docKind()` is reachable from a subagent render, so the render can select the right
 * checklist itself instead of the caller pasting one into the prompt.
 *
 * Now composes the FIX for anything it fails, not just a diagnosis — a `fixer` subagent applies that
 * fix verbatim, with no independent judgment of its own, so this role bears the responsibility for
 * getting the fix right, not just for naming what's wrong.
 *
 * `report_run_result` cannot derive the run's verdict from a schema-validated result (there is no
 * harness tool holding one any more), so it asks the model for it directly — see self-report.ts for
 * the tradeoff that reopens.
 */
export function Reviewer() {
  const kind = docKind();
  return [instructions, ``, checklistBlock(kind), ``, styleBlock()].join('\n');
}

export const reviewer = defineSubagent({
  name: 'reviewer',
  ...TIERS.reviewer,
  description:
    'Evaluates a written documentation page two ways, whichever the task names: a full-page check ' +
    'against its document kind\'s checklist and the writing-style rules, or a fact-check of one ' +
    'section (or a small batch) against the library source. Reports per-item pass/fail or per-drift ' +
    'findings in prose, each with the exact corrected statement to apply — applies no fixes itself.',
  agent: Reviewer,
});
