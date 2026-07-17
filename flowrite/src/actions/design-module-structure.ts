import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { moduleResearchSchema } from './research-module.ts';
import { isPhaseSkipped } from '../shared/skip-phases.ts';
import { authorHint } from '../shared/author-hint.ts';
import { withTransientRetry } from '../shared/style-loop.ts';
// Injected into the generic designer's task (skills can't vary per session.task
// call); the SKILL.md points here. Same source-of-truth split as data-type-ref.
import moduleStructureDoc from '../skills/module-ref-structure/references/structure.md' with { type: 'markdown' };

// The module-reference structural plan. Two things are genuine per-module
// decisions the drafter would otherwise improvise: (1) the layout (flat single
// page vs hierarchical index+subpages), which drives the entire write phase, and
// (2) which module-level sections apply and the order types are documented in.
// Planning them up front lets the drafter follow a validated plan.
export const moduleStructureSchema = v.object({
  layout: v.pipe(
    v.picklist(['flat', 'hierarchical']),
    v.description(
      'flat = single docs/reference/<module>.md with types inline; hierarchical = index + per-type subpages. ' +
        'Auto-rule: flat for ≤4 core types or always-together types; hierarchical for ≥5 core types or ≥3 rich types.',
    ),
  ),
  layoutRationale: v.pipe(v.string(), v.description('One sentence: why this layout, per the auto-rule (or the override)')),
  optionalSections: v.object({
    motivation: v.boolean(),
    installation: v.pipe(v.boolean(), v.description('true only for a top-level published module')),
    overview: v.pipe(v.boolean(), v.description('per-type overview; recommended for hierarchical')),
    howTheyWorkTogether: v.pipe(v.boolean(), v.description('the centerpiece — should be true for any real module')),
    commonPatterns: v.boolean(),
    integration: v.boolean(),
    runningExamples: v.pipe(v.boolean(), v.description('true only when standalone example files will exist')),
  }),
  typeOrder: v.pipe(
    v.array(v.string()),
    v.description('Every core and supporting type name, in the order the page documents them; must cover all research types'),
  ),
  comparisons: v.pipe(
    v.array(v.string()),
    v.description('Which module-level analogue types to compare against (subset of research comparisons); empty if none'),
  ),
  notes: v.nullable(v.pipe(v.string(), v.description('Any structural decisions/rationale, or null'))),
});

/**
 * Turn the module researcher's findings into a validated structural plan: the
 * flat-vs-hierarchical layout (via the auto-rule, unless overridden), which
 * module-level sections apply, and the type order. Delegates to the generic
 * `designer` subagent — see design-tutorial-structure.ts for why bare
 * harness.session() is unsafe here. Mirrors design-data-type-structure.ts.
 */
export const designModuleStructure = defineAction({
  name: 'design_module_structure',
  description: 'Turn module research into a validated module-reference plan (flat/hierarchical layout + section applicability + type order).',
  input: v.object({
    moduleName: v.string(),
    researchAnswers: moduleResearchSchema,
    layoutOverride: v.pipe(
      v.optional(v.picklist(['flat', 'hierarchical'])),
      v.description('Force a layout instead of the auto-rule; omit to let the designer decide.'),
    ),
  }),
  output: moduleStructureSchema,
  async run({ harness, input, log }) {
    // Resume support — see research-tutorial-topic.ts.
    if (isPhaseSkipped('design')) {
      log.info('Skipping design (skipPhases)');
      return {
        layout: input.layoutOverride ?? 'flat',
        layoutRationale: '(skipped — phase already done)',
        optionalSections: {
          motivation: false,
          installation: false,
          overview: false,
          howTheyWorkTogether: false,
          commonPatterns: false,
          integration: false,
          runningExamples: false,
        },
        typeOrder: [],
        comparisons: [],
        notes: '(skipped — phase already done)',
      };
    }

    log.info(`Designing module-reference structure for: ${input.moduleName}`);
    const session = await harness.session();
    const { data } = await withTransientRetry(log, 'designer (module)', () =>
      session.task(
      [
        `Design the structural plan for a "${input.moduleName}" module reference page.`,
        ``,
        `Follow this module-ref-structure template exactly:`,
        ``,
        moduleStructureDoc,
        ``,
        input.layoutOverride
          ? `The caller REQUIRES the "${input.layoutOverride}" layout — set layout to it and explain briefly.`
          : `Decide the layout from the auto-rule (flat for ≤4 core types or always-together types; ` +
            `hierarchical for ≥5 core types or ≥3 rich self-contained types).`,
        ``,
        `Decide which module-level sections apply and order EVERY type (core + supporting) in typeOrder.`,
        `Ground every choice in these research answers:`,
        JSON.stringify(input.researchAnswers),
      ].join('\n') + authorHint(),
      { agent: 'designer', result: moduleStructureSchema },
    ));
    return data;
  },
});
