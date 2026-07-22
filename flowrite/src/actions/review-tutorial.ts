import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { isPhaseSkipped } from '../shared/skip-phases.ts';
import { reviewSchema } from '../shared/schemas.ts';
import { runCappedReview } from '../shared/review.ts';
import { checkMdocFencesGate } from '../tools/check-mdoc-fences.ts';
// The tutorial-checklist skill's content, injected into the generic reviewer's
// task (skills can't vary per session.task call). Same source-of-truth split as
// writing-style/references/rules.md; the SKILL.md points here.
import tutorialChecklistDoc from '../skills/tutorial-checklist/references/checklist.md' with { type: 'markdown' };

/**
 * Evaluate a written tutorial against the tutorial-checklist skill and report
 * per-item pass/fail. The agent resolves every failing item before finishing.
 * Capped at MAX_REVIEW_CALLS per run — see runCappedReview.
 */
export const reviewTutorial = defineAction({
  name: 'review_tutorial',
  description: 'Evaluate a written tutorial against the tutorial-checklist and report per-item pass/fail.',
  input: v.object({
    path: v.pipe(v.string(), v.description('Path to the tutorial markdown, e.g. docs/guides/scope.md')),
  }),
  output: reviewSchema,
  async run({ harness, input, log }) {
    if (isPhaseSkipped('review')) {
      log.info('Skipping review (skipPhases)');
      return { passed: true, items: [{ item: 'Review', pass: true, issue: 'Skipped by request.' }] };
    }

    return runCappedReview({
      actionName: 'review_tutorial',
      promptNoun: 'tutorial',
      headerLabel: 'TUTORIAL',
      checklistDoc: tutorialChecklistDoc,
      harness,
      path: input.path,
      log,
      extraGates: async () => [await checkMdocFencesGate(process.env.REPO_PATH!, [input.path])],
    });
  },
});
