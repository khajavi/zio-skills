import { type FlueHarness, type FlueLogger, defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { isPhaseSkipped } from '../../runtime/skip-phases.ts';
import { type DocKind, authorHint, docKind, maxReviewRounds } from '../../runtime/run-context.ts';
import { delegate } from '../../runtime/delegate.ts';
// Each kind's checklist and the writing-style rules, injected into the generic reviewer's task
// (skills are role-owned and cannot vary per delegated task). Same source-of-truth split as before:
// the SKILL.md files point at these.
import rulesMarkdown from '../../skills/writing-style/references/rules.md';
import dataTypeChecklistDoc from '../../skills/data-type-ref-checklist/references/checklist.md';
import moduleChecklistDoc from '../../skills/module-ref-checklist/references/checklist.md';
import tutorialChecklistDoc from '../../skills/tutorial-checklist/references/checklist.md';

/**
 * The review phase: a simple LLM review.
 *
 * One delegation to the generic `reviewer` role per call — the kind's checklist, the writing-style
 * rules, and the page. The reviewer judges everything; the verdict is whatever it reports.
 *
 * This deliberately replaces a registry of code checks (15 mechanical style graders, a
 * reference-existence check, per-type method coverage, free-first triage, narrowed repeats, a payload
 * guard and a stall guard) — removed by direction on 2026-08-12: checking through code was not wanted,
 * a simple model-based review was. The verdict recorder outlived that removal by a few hours and then
 * went too, so nothing outside this function keeps the result: `report_run_result` takes the model's
 * word for what the review concluded.
 *
 * Known costs of this shape, measured before the registry existed: every call re-judges everything
 * (there is no cheap confirming pass), rules that are arithmetic — table padding, title case, line
 * counting — are judged by a model again, and a run's recorded pass/fail is now self-reported. The
 * first of those is why a run gets a bounded number of rounds — see maxReviewRounds().
 */

/**
 * Per-item pass/fail from a checklist review. `passed` is true only when every item passes.
 *
 * Lives here because the review phase is the only thing that produces or consumes it. It sat in a
 * shared schemas module back when there were three review tools in three files; they are one file
 * now, and `report_run_result` takes the verdict as the model's own claim rather than this shape.
 */
export const reviewSchema = v.object({
  passed: v.pipe(v.boolean(), v.description('true only when every checklist item passes')),
  items: v.array(
    v.object({
      item: v.string(),
      pass: v.boolean(),
      issue: v.nullable(v.pipe(v.string(), v.description('Specific problem when pass is false'))),
    }),
  ),
});

/**
 * The review phase: a simple LLM review.
 *
 * One delegation to the generic `reviewer` role per call — the kind's checklist, the writing-style
 * rules, and the page. The reviewer judges everything; the verdict is whatever it reports.
 *
 * This deliberately replaces a registry of code checks (15 mechanical style graders, a
 * reference-existence check, per-type method coverage, free-first triage, narrowed repeats, a payload
 * guard and a stall guard) — removed by direction on 2026-08-12: checking through code was not wanted,
 * a simple model-based review was. The verdict recorder outlived that removal by a few hours and then
 * went too, so nothing outside this function keeps the result: `report_run_result` takes the model's
 * word for what the review concluded.
 *
 * Known costs of this shape, measured before the registry existed: every call re-judges everything
 * (there is no cheap confirming pass), rules that are arithmetic — table padding, title case, line
 * counting — are judged by a model again, and a run's recorded pass/fail is now self-reported.
 */
/**
 * Review rounds spent this run.
 *
 * Module state, like every other per-run counter here: one OS process per run (each `run-*.sh` execs a
 * fresh node), and a run documents one page. Counted across all three review tools on purpose — a
 * module run reviewing an index and then a subpage is still spending one budget.
 */
let roundsUsed = 0;

/** Reset the round counter. Tests only — the counter is module state with no other seam. */
export function __resetReviewRoundsForTests(): void {
  roundsUsed = 0;
}

/**
 * The budget, stated in every review tool's description.
 *
 * Derived from the same function the enforcement uses, so raising `MAX_REVIEW_ROUNDS` changes what the
 * model is told in the same breath as what it is allowed. A description promising a confirming round
 * that the code then refuses is worse than no description: it spends a turn on a tool error.
 */
function reviewBudgetNote(): string {
  const budget = maxReviewRounds();
  return budget === 1
    ? 'This run allows ONE review round: there is no confirming pass, so fix what it reports and ' +
        'finish rather than calling review again.'
    : `This run allows ${budget} review rounds in total; when they are spent, fix what was reported ` +
        `and finish rather than calling review again.`;
}

/**
 * Spend one review round, or refuse.
 *
 * Thrown rather than returned, and thrown BEFORE any delegation so a refused round costs nothing. The
 * runtime surfaces a thrown error to the calling model as a tool error, which it reads as an
 * instruction — the same mechanism phase-guard.ts relies on. So the message has to say what to do
 * next, because it is the only prompt the model gets at this point.
 */
export function consumeReviewRound(): void {
  const budget = maxReviewRounds();
  if (roundsUsed >= budget) {
    throw new Error(
      `The review budget for this run is spent (${budget} round${budget === 1 ? '' : 's'}, all used). ` +
        `Do not call review again. Fix what the last review reported, then file report_run_result ` +
        `with reviewVerdict "failed" and every still-failing item in failingItems — name them in your ` +
        `summary and your reply too. Do not describe an unverified page as complete.`,
    );
  }
  roundsUsed++;
}

/** What the review prompt needs that differs per kind: the checklist, and two bits of wording. */
const KIND_REVIEW: Record<DocKind, { checklistDoc: string; noun: string; label: string }> = {
  'data-type': {
    checklistDoc: dataTypeChecklistDoc,
    noun: 'data type reference page',
    label: 'REFERENCE PAGE',
  },
  module: {
    checklistDoc: moduleChecklistDoc,
    noun: 'module reference page',
    label: 'MODULE REFERENCE',
  },
  tutorial: {
    checklistDoc: tutorialChecklistDoc,
    noun: 'tutorial',
    label: 'TUTORIAL',
  },
};

/**
 * Review the page at `path` against its kind's checklist and the writing style rules.
 *
 * ONE tool for all three kinds, unlike the research, design and write phases. Those keep a tool per
 * kind because each carries a different result schema that the next phase embeds verbatim; review
 * has neither — every kind takes `{ path }` and returns `reviewSchema`. All that differed was which
 * checklist string got pasted into the prompt, which is data, and the kind now arrives through the
 * run context rather than as a parameter the model could get wrong.
 */
export const reviewPage = defineTool({
  name: 'review_page',
  description:
    'Review the finished page against its document kind\'s checklist and the writing style rules; ' +
    'report per-item pass/fail. Fix the failures yourself. ' +
    reviewBudgetNote(),
  harness: true,
  input: v.object({
    path: v.pipe(
      v.string(),
      v.description(
        'The page to review, repo-relative — e.g. docs/reference/prism.md, docs/guides/scope.md, or a ' +
          'module reference\'s flat page or hierarchical index.',
      ),
    ),
  }),
  output: reviewSchema,
  async run({ harness, data, log }) {
    if (isPhaseSkipped('review')) {
      return {
        output: { passed: true, items: [{ item: 'Review', pass: true, issue: 'Skipped by request.' }] },
      };
    }

    // Before the file read and the delegation: a refused round must cost nothing. A skipped phase
    // does not spend budget, since it never reviewed anything.
    consumeReviewRound();

    const kind = KIND_REVIEW[docKind()];
    const content = await harness.sandbox.readFile(data.path);
    return {
      output: await delegate({
        harness,
        log,
        label: 'reviewer',
        role: 'reviewer',
        result: reviewSchema,
        prompt: [
          `Evaluate the ${kind.noun} below against every item in this checklist:`,
          ``,
          kind.checklistDoc,
          ``,
          `Also check it against every one of these writing style rules, reporting each violation as a`,
          `failing item named "writing-style rule <N>" with the line and a specific, actionable issue:`,
          ``,
          rulesMarkdown,
          // Before the content delimiter, so the hint reads as reviewer guidance rather than as part
          // of the page under review.
          authorHint(),
          ``,
          `--- ${kind.label} (${data.path}) ---`,
          content,
        ].join('\n'),
      }),
    };
  },
});
