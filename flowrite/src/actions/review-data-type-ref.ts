import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { isPhaseSkipped } from '../shared/skip-phases.ts';
import { reviewSchema } from '../shared/schemas.ts';
import { runCappedReview } from '../shared/review.ts';
import { computeMethodCoverage } from '../tools/check-method-coverage.ts';
// The data-type-ref-checklist skill's content, injected into the generic reviewer's
// task (skills can't vary per session.task call). Same source-of-truth split as
// writing-style/references/rules.md; the SKILL.md points here.
import dataTypeChecklistDoc from '../skills/data-type-ref-checklist/references/checklist.md';

/**
 * Evaluate a written data type reference page. The review phase is the single
 * quality gate for a reference page: it runs (1) deterministic method-coverage
 * (is every public member documented?), (2) the mechanical writing-style loop,
 * and (3) the data-type-ref-checklist (structure + content + technical accuracy).
 * Capped at MAX_REVIEW_CALLS per run — see runCappedReview.
 */
export const reviewDataTypeRef = defineAction({
  name: 'review_data_type_ref',
  description: 'Review a data type reference page: method coverage + writing-style + the data-type-ref-checklist; report per-item pass/fail.',
  input: v.object({
    path: v.pipe(v.string(), v.description('Path to the reference markdown, e.g. docs/reference/chunk.md')),
    typeName: v.pipe(v.string(), v.description('The documented type, e.g. "Chunk" — used for method-coverage')),
  }),
  output: reviewSchema,
  async run({ harness, input, log }) {
    if (isPhaseSkipped('review')) {
      log.info('Skipping review (skipPhases)');
      return { passed: true, items: [{ item: 'Review', pass: true, issue: 'Skipped by request.' }] };
    }

    return runCappedReview({
      actionName: 'review_data_type_ref',
      promptNoun: 'data type reference page',
      headerLabel: 'REFERENCE PAGE',
      checklistDoc: dataTypeChecklistDoc,
      harness,
      path: input.path,
      log,
      // Method coverage (deterministic): does the page document every public
      // member? Folded into review as a gate, not a separate step. Heuristic
      // (see computeMethodCoverage), so a non-empty `missing` is a flag to check.
      extraGates: async () => {
        const coverage = await computeMethodCoverage(process.env.REPO_PATH!, input.typeName, input.path);
        return [
          {
            item: `Method coverage (${coverage.coveragePercent}%)`,
            pass: coverage.missing.length === 0,
            issue:
              coverage.missing.length === 0
                ? null
                : `Undocumented public members (heuristic — verify against source, then document or justify): ${coverage.missing.join(', ')}. ${coverage.note}`,
          },
        ];
      },
    });
  },
});
