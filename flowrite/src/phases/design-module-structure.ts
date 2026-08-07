import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { moduleResearchSchema } from './research-module.ts';
import { isPhaseSkipped } from '../shared/skip-phases.ts';
import { authorHint } from '../shared/author-hint.ts';
import { delegate } from '../shared/delegate.ts';
// Injected into the generic designer's task (skills can't vary per delegated
// task); the SKILL.md points here. Same source-of-truth split as data-type-ref.
import moduleStructureDoc from '../skills/module-ref-structure/references/structure.md';

// The module-reference structural plan. Two things are genuine per-module
// decisions the drafter would otherwise improvise: (1) the layout (flat single
// page vs hierarchical index+subpages), which drives the entire write phase, and
// (2) which module-level sections apply and the order types are documented in.
// Planning them up front lets the drafter follow a validated plan.
export const moduleStructureSchema = v.object({
  shape: v.pipe(
    v.picklist(['single-core', 'core-family', 'multi-domain', 'dsl']),
    v.description(
      'Module classification by reader intent (see module-ref-structure "Classify the module first"). ' +
        'single-core = one dominant core type; core-family = several co-equal core types in one domain; ' +
        'multi-domain = core types across ≥2 sub-domains; dsl = no dominant core, co-equal types combined. ' +
        'Drives layout AND (for dsl) the by-task page body.',
    ),
  ),
  layout: v.pipe(
    v.picklist(['flat', 'hierarchical']),
    v.description(
      'File structure derived from shape: single-core/dsl → flat (one docs/reference/<module>.md); ' +
        'core-family/multi-domain → hierarchical (index + per-type subpages).',
    ),
  ),
  layoutRationale: v.pipe(v.string(), v.description('One sentence: why this shape/layout (per the classification or the override)')),
  optionalSections: v.object({
    motivation: v.boolean(),
    installation: v.pipe(v.boolean(), v.description('true only for a top-level published module')),
    overview: v.pipe(v.boolean(), v.description('per-type overview; recommended for hierarchical')),
    howTheyWorkTogether: v.pipe(v.boolean(), v.description('the centerpiece — should be true for any real module')),
    commonPatterns: v.boolean(),
    integration: v.boolean(),
    runningExamples: v.pipe(v.boolean(), v.description('true only when standalone example files will exist')),
  }),
  typeGroups: v.pipe(
    v.array(
      v.object({
        label: v.pipe(
          v.string(),
          v.description('Domain group name — a concern the types share, e.g. for an HTTP module: "Routing", "Http Messages", "Endpoints".'),
        ),
        types: v.pipe(
          v.array(
            v.object({
              name: v.string(),
              kind: v.pipe(
                v.picklist(['core', 'supporting']),
                v.description('Page depth: "core" = comprehensive, "supporting" = minimal (role + one usage example)'),
              ),
            }),
          ),
          v.description('Types in this group, in reading order'),
        ),
      }),
    ),
    v.description('Every type organized into named domain groups in reading order; must cover all research types'),
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
 * `designer` subagent — see design-tutorial-structure.ts for why designing in
 * the calling agent's own conversation is unsafe here. Mirrors
 * design-data-type-structure.ts.
 */
export const designModuleStructure = defineTool({
  name: 'design_module_structure',
  description: 'Turn module research into a validated module-reference plan (flat/hierarchical layout + section applicability + type order).',
  harness: true,
  input: v.object({
    moduleName: v.string(),
    researchAnswers: moduleResearchSchema,
    layoutOverride: v.pipe(
      v.optional(v.picklist(['flat', 'hierarchical'])),
      v.description('Force a layout instead of the auto-rule; omit to let the designer decide.'),
    ),
    shapeOverride: v.pipe(
      v.optional(v.picklist(['single-core', 'core-family', 'multi-domain', 'dsl'])),
      v.description('Force the module shape (skips classification) and derive layout from it. Wins over layoutOverride and auto-classify.'),
    ),
  }),
  output: moduleStructureSchema,
  async run({ harness, data, log }) {
    // Resume support — see research-tutorial-topic.ts.
    if (isPhaseSkipped('design')) {
      log.info('Skipping design (skipPhases)');
      return {
        output: {
          shape: data.shapeOverride ?? 'single-core',
          layout: data.layoutOverride ?? 'flat',
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
          typeGroups: [],
          comparisons: [],
          notes: '(skipped — phase already done)',
        },
      };
    }

    log.info(`Designing module-reference structure for: ${data.moduleName}`);
    const structure = await delegate({
      harness,
      log,
      label: 'designer (module)',
      role: 'designer',
      result: moduleStructureSchema,
      prompt:
        [
          `Design the structural plan for a "${data.moduleName}" module reference page.`,
          ``,
          `Follow this module-ref-structure template exactly:`,
          ``,
          moduleStructureDoc,
          ``,
          data.shapeOverride
            ? `The caller REQUIRES the "${data.shapeOverride}" shape — set shape to it and derive layout ` +
              `(single-core/dsl → flat, core-family/multi-domain → hierarchical).`
            : data.layoutOverride
              ? `The caller REQUIRES the "${data.layoutOverride}" layout — set layout to it, set the shape that ` +
                `matches, and explain briefly.`
              : `CLASSIFY THE MODULE'S SHAPE FIRST (see "Classify the module first"): run the discriminator + ` +
                `operational test, set "shape", then derive layout (single-core/dsl → flat, core-family/` +
                `multi-domain → hierarchical). If the shape is genuinely uncertain after the test, do NOT guess ` +
                `silently — set your best-effort shape and FLAG the ambiguity explicitly in "notes" so the agent can halt and ask.`,
          ``,
          `Decide which module-level sections apply. Organize EVERY type into named groups in reading order.`,
          `For a core-type shape each group is a domain concern the types share (what they do together), e.g.`,
          `for an HTTP module "Routing", "Http Messages", "Endpoints". For a "dsl" shape group by TASK/`,
          `composition concern (recipes) instead — the types still appear (they inform the page) but get NO`,
          `per-type pages. Separately, tag each type "core" (documented comprehensively) or "supporting" (a`,
          `minimal page); this is per-type depth, independent of its group.`,
          `Assign an entry-point/singleton object (e.g. trace/log/metric) to the sub-domain it serves; it`,
          `anchors that sub-domain's index.`,
          `Ground every choice in these research answers:`,
          JSON.stringify(data.researchAnswers),
        ].join('\n') + authorHint(),
    });
    return { output: structure };
  },
});
