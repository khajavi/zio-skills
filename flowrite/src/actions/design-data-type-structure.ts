import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { dataTypeResearchSchema } from './research-data-type.ts';
import { isPhaseSkipped } from '../shared/skip-phases.ts';
// Injected into the generic designer's task (skills can't vary per session.task
// call); the SKILL.md points here. Same source-of-truth split as rules.md.
import dataTypeStructureDoc from '../skills/data-type-ref-structure/references/structure.md' with { type: 'markdown' };

// The reference-page structural plan. The 12-section template is fixed, but two
// things are genuinely per-type decisions that the drafter otherwise improvises
// mid-write (and got wrong in early runs: single-method categories violating the
// no-lone-subheader rule, a member nested under the wrong category): (1) which
// optional sections apply, and (2) how the public operations group into Core
// Operations categories. Planning both up front lets the drafter follow a
// validated plan instead of inventing structure while writing prose.
export const dataTypeStructureSchema = v.object({
  optionalSections: v.object({
    motivation: v.boolean(),
    installation: v.pipe(v.boolean(), v.description('true only for top-level module types')),
    predefinedInstances: v.boolean(),
    subtypes: v.boolean(),
    comparisons: v.boolean(),
    advancedUsage: v.boolean(),
    integration: v.boolean(),
    runningExamples: v.pipe(v.boolean(), v.description('true only when standalone example files will exist')),
  }),
  constructionOrder: v.pipe(
    v.array(v.string()),
    v.description('Constructor / factory names in the order the Construction section documents them'),
  ),
  coreOperationCategories: v.pipe(
    v.array(
      v.object({
        category: v.pipe(v.string(), v.description('e.g. "Element Access", "Transformations", "Composition"')),
        methods: v.pipe(
          v.array(v.string()),
          v.description('Method names in this category. Prefer merging a singleton into a related category; a single-method category is fine when none fits.'),
        ),
      }),
    ),
    v.description('Every public operation grouped into ordered categories; the union must cover all coreOperations from research.'),
  ),
  comparisons: v.pipe(
    v.array(v.string()),
    v.description('Which analogue types to compare against (subset of research comparisons); empty if none'),
  ),
  notes: v.nullable(v.pipe(v.string(), v.description('Any structural decisions/rationale, or null'))),
});

/**
 * Turn the researcher's API-surface findings into a validated structural plan:
 * which optional sections apply and how the operations group into Core
 * Operations categories. Delegates to the generic `designer` subagent — see
 * design-tutorial-structure.ts for why bare harness.session() is unsafe here.
 */
export const designDataTypeStructure = defineAction({
  name: 'design_data_type_structure',
  description: 'Turn data-type research into a validated reference-page structural plan (section applicability + Core Operations grouping).',
  input: v.object({
    typeName: v.string(),
    researchAnswers: dataTypeResearchSchema,
  }),
  output: dataTypeStructureSchema,
  async run({ harness, input, log }) {
    // Resume support — see research-tutorial-topic.ts.
    if (isPhaseSkipped('design')) {
      log.info('Skipping design (skipPhases)');
      return {
        optionalSections: {
          motivation: false,
          installation: false,
          predefinedInstances: false,
          subtypes: false,
          comparisons: false,
          advancedUsage: false,
          integration: false,
          runningExamples: false,
        },
        constructionOrder: [],
        coreOperationCategories: [],
        comparisons: [],
        notes: '(skipped — phase already done)',
      };
    }

    log.info(`Designing reference-page structure for: ${input.typeName}`);
    const session = await harness.session();
    // Delegates to the generic designer subagent — see design-tutorial-structure.ts
    // for why bare harness.session() on the calling agent is unsafe here.
    const { data } = await session.task(
      [
        `Design the structural plan for a "${input.typeName}" data type reference page.`,
        ``,
        `Follow this data-type-ref-structure template exactly:`,
        ``,
        dataTypeStructureDoc,
        ``,
        `Decide which optional sections apply, order the constructors, and group EVERY`,
        `public operation into ordered Core Operations categories (a single-method`,
        `category is fine when none fits). Ground every choice in these research answers:`,
        JSON.stringify(input.researchAnswers),
      ].join('\n'),
      { agent: 'designer', result: dataTypeStructureSchema },
    );
    return data;
  },
});
