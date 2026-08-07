import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { isPhaseSkipped } from '../shared/skip-phases.ts';
import { reviewSchema } from '../shared/schemas.ts';
import { runCappedReview } from '../shared/review.ts';
// The tutorial-checklist skill's content, injected into the generic reviewer's
// task (skills can't vary per delegated task). Same source-of-truth split as
// writing-style/references/rules.md; the SKILL.md points here.
import tutorialChecklistDoc from '../skills/tutorial-checklist/references/checklist.md';

/**
 * Evaluate a written tutorial against the tutorial-checklist skill and report
 * per-item pass/fail. The agent resolves every failing item before finishing.
 * Capped at MAX_REVIEW_CALLS per run — see runCappedReview.
 */
export const reviewTutorial = defineTool({
  name: 'review_tutorial',
  description: 'Evaluate a written tutorial against the tutorial-checklist and report per-item pass/fail.',
  harness: true,
  input: v.object({
    path: v.pipe(v.string(), v.description('Path to the tutorial markdown, e.g. docs/guides/scope.md')),
  }),
  output: reviewSchema,
  async run({ harness, data, log }) {
    if (isPhaseSkipped('review')) {
      log.info('Skipping review (skipPhases)');
      return { output: { passed: true, items: [{ item: 'Review', pass: true, issue: 'Skipped by request.' }] } };
    }

    return {
      output: await runCappedReview({
        actionName: 'review_tutorial',
        promptNoun: 'tutorial',
        headerLabel: 'TUTORIAL',
        checklistDoc: tutorialChecklistDoc,
        harness,
        path: data.path,
        log,
      }),
    };
  },
});
