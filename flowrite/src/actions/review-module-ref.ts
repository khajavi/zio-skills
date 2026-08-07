import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { toKebabCase } from './write-data-type-reference.ts';
import { isPhaseSkipped } from '../shared/skip-phases.ts';
import { reviewSchema } from '../shared/schemas.ts';
import { runCappedReview } from '../shared/review.ts';
import { computeMethodCoverage } from '../tools/check-method-coverage.ts';
// The module-ref-checklist skill's content, injected into the generic reviewer's
// task (skills can't vary per session.task call). Same source-of-truth split as
// data-type-ref; the SKILL.md points here.
import moduleChecklistDoc from '../skills/module-ref-checklist/references/checklist.md';

/**
 * Evaluate a written module reference. The cost-bounded quality gate: it runs
 * (1) deterministic method-coverage looped over EVERY module type (cheap — no
 * model calls), (2) the mechanical writing-style loop, and (3) the
 * module-ref-checklist over the module page (flat page or hierarchical index).
 * It deliberately does NOT run a full per-type LLM checklist on each subpage —
 * that is the N×LLM cost the design cut. Capped at MAX_REVIEW_CALLS per run.
 */
export const reviewModuleRef = defineAction({
  name: 'review_module_ref',
  description: 'Review a module reference: per-type method coverage + writing-style + the module-ref-checklist on the module page; report per-item pass/fail.',
  input: v.object({
    path: v.pipe(v.string(), v.description('Path to the module page reviewed against the checklist: the flat page or the hierarchical index')),
    layout: v.picklist(['flat', 'hierarchical']),
    moduleName: v.pipe(v.string(), v.description('The module name — used to locate hierarchical subpages')),
    typeNames: v.pipe(v.array(v.string()), v.description('Every documented type name — one method-coverage gate runs per type')),
  }),
  output: reviewSchema,
  async run({ harness, input, log }) {
    if (isPhaseSkipped('review')) {
      log.info('Skipping review (skipPhases)');
      return { passed: true, items: [{ item: 'Review', pass: true, issue: 'Skipped by request.' }] };
    }

    const moduleKebab = toKebabCase(input.moduleName);

    return runCappedReview({
      actionName: 'review_module_ref',
      promptNoun: 'module reference page',
      headerLabel: 'MODULE REFERENCE',
      checklistDoc: moduleChecklistDoc,
      harness,
      path: input.path,
      log,
      // Method coverage per type (deterministic). Flat: every type is documented
      // in the single page (input.path). Hierarchical: each type is its own
      // subpage under docs/reference/<module>/<type>.md.
      extraGates: async () => {
        const repoPath = process.env.REPO_PATH!;
        return Promise.all(
          input.typeNames.map(async (typeName) => {
            const pagePath =
              input.layout === 'flat' ? input.path : `docs/reference/${moduleKebab}/${toKebabCase(typeName)}.md`;
            const coverage = await computeMethodCoverage(repoPath, typeName, pagePath);
            return {
              item: `Method coverage — ${typeName} (${coverage.coveragePercent}%)`,
              pass: coverage.missing.length === 0,
              issue:
                coverage.missing.length === 0
                  ? null
                  : `Undocumented public members of ${typeName} (heuristic — verify against source, then document or justify): ${coverage.missing.join(', ')}. ${coverage.note}`,
            };
          }),
        );
      },
    });
  },
});
