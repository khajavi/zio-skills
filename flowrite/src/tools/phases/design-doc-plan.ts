import { type FlueHarness, type FlueLogger, defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { dataTypeResearchSchema, moduleResearchSchema, tutorialResearchSchema } from './research.ts';
import { isPhaseSkipped } from '../../runtime/skip-phases.ts';
import { authorHint } from '../../runtime/run-context.ts';
import { delegate } from '../../runtime/delegate.ts';
import { recordModulePlan } from './phase-ledger.ts';
// Each kind's structure template, injected into the generic designer's task (a subagent's skills
// cannot vary per delegated task, so the kind-specific template rides in the prompt). Same
// single-source-of-truth split as writing-style/references/rules.md: the SKILL.md files point here.
import dataTypeTemplateDoc from '../../skills/data-type-ref-structure/references/structure.md';
import moduleTemplateDoc from '../../skills/module-ref-structure/references/structure.md';
import tutorialTemplateDoc from '../../skills/tutorial-structure/references/structure.md';
import { note } from '../../runtime/log.ts';

/**
 * The design phase: turn one kind's research findings into a validated plan.
 *
 * ONE body, THREE tools — deliberately not one tool over a `v.variant`. The three plans have
 * genuinely different shapes (a tutorial has no `coreOperationCategories`; only a module has a
 * `layout`), and each is embedded verbatim in the matching write phase's input. A variant would
 * therefore cost three things a shared body costs nothing:
 *
 *  - **Registry weight.** `KINDS` mounts phase tools per kind, so exactly one design tool exists in
 *    any run today. A variant carries all three research schemas and all three plan schemas in every
 *    run — and a harness tool's scratch conversation inherits the parent's whole tool registry, so
 *    that weight is re-sent on every phase turn.
 *  - **A guarantee.** Designing a module plan during a data-type run is impossible right now because
 *    the tool is not mounted. A variant would demote that to a branch the model picks, which is the
 *    misclassification failure the pipeline already halts on rather than guesses at.
 *  - **The handoff.** `write_data_type_reference.plan` *is* `dataTypePlanSchema`. A union
 *    output either makes the write phases narrow it, or turns a wrong branch into a validation error
 *    one phase later instead of an impossibility.
 *
 * What was actually duplicated — the skip branch, the log line, the `delegate` call and the prompt
 * skeleton — is now written once, in `designPlan`.
 */

// The reference-page plan. The 12-section template is fixed, but two things are genuinely
// per-type decisions that the drafter otherwise improvises mid-write (and got wrong in early runs:
// single-method categories violating the no-lone-subheader rule, a member nested under the wrong
// category): (1) which optional sections apply, and (2) how the public operations group into Core
// Operations categories. Planning both up front lets the drafter follow a validated plan instead of
// inventing structure while writing prose.
export const dataTypePlanSchema = v.object({
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
    v.description('Constructor / factory names in the order the Creating Values section documents them'),
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

// The module-reference plan. Two things are genuine per-module decisions the drafter would
// otherwise improvise: (1) the layout (flat single page vs hierarchical index+subpages), which drives
// the entire write phase, and (2) which module-level sections apply and the order types are
// documented in. Planning them up front lets the drafter follow a validated plan.
export const modulePlanSchema = v.object({
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

// The tutorial's section plan: strictly linear, one new concept per section.
export const tutorialPlanSchema = v.object({
  learningObjectives: v.pipe(v.array(v.string()), v.description('3-5 objectives')),
  prerequisites: v.array(v.string()),
  sections: v.array(
    v.object({
      number: v.number(),
      title: v.pipe(v.string(), v.description('Numbered heading, e.g. "1. Creating a Scope"')),
      concept: v.pipe(v.string(), v.description('The single new concept this section teaches')),
      verifiableOutput: v.nullable(
        v.pipe(
          v.string(),
          v.description(
            'A verifiable output: a point where printed or observed output lets the learner confirm ' +
              'the code behaved as claimed.',
          ),
        ),
      ),
    }),
  ),
  coreInsight: v.pipe(
    v.string(),
    v.description('The core insight: the single realization the whole tutorial drives the learner toward.'),
  ),
});

/**
 * Design one document's plan by delegating to the generic `designer` subagent.
 *
 * The delegation is not incidental. The designer has no tools or subagents of its own, whereas the
 * calling agent's own `design_*` tool is visible to whoever does the designing — so designing inside
 * the calling agent's conversation lets it call itself and recurse until the delegation depth limit
 * is hit. `delegate` still prompts through the calling agent (`harness.prompt`), so the lead-in it
 * prepends is what pushes the work out to the narrow role instead. Every phase in this pipeline
 * delegates for that reason.
 *
 * `skipDefault` is per kind because it is the empty instance of that kind's own schema — data, not
 * logic, which is why the skip branch itself lives here only once.
 */
async function designPlan<S extends v.GenericSchema>(opts: {
  harness: FlueHarness;
  log: FlueLogger;
  /** Log/delegation label, e.g. 'designer (module)'. */
  label: string;
  result: S;
  /** Returned verbatim when `skipPhases` includes design. */
  skipDefault: v.InferOutput<S>;
  /** What the phase announces it is designing, e.g. 'reference-page plan for: Prism'. */
  designing: string;
  /** First prompt line, e.g. 'Design the plan for a "Prism" data type reference page.' */
  task: string;
  /** Template name as the prompt cites it, e.g. 'data-type-ref-structure'. */
  templateName: string;
  templateDoc: string;
  /** Per-kind planning instructions, between the template and the research payload. */
  guidance: string[];
  researchAnswers: unknown;
}): Promise<v.InferOutput<S>> {
  // Resume support — see research.ts.
  if (isPhaseSkipped('design')) {
    note(opts.log, 'Skipping design (skipPhases)');
    return opts.skipDefault;
  }

  note(opts.log, `Designing ${opts.designing}`);
  return await delegate({
    harness: opts.harness,
    log: opts.log,
    label: opts.label,
    role: 'designer',
    result: opts.result,
    prompt:
      [
        opts.task,
        ``,
        `Follow this ${opts.templateName} template exactly:`,
        ``,
        opts.templateDoc,
        ``,
        ...opts.guidance,
        `Ground every choice in these research answers:`,
        JSON.stringify(opts.researchAnswers),
      ].join('\n') + authorHint(),
  });
}

/**
 * Turn the researcher's API-surface findings into a validated plan: which optional
 * sections apply and how the operations group into Core Operations categories.
 */
export const designDataTypePlan = defineTool({
  name: 'design_data_type_plan',
  description: 'Turn data-type research into a validated reference-page plan (section applicability + Core Operations grouping).',
  harness: true,
  input: v.object({
    typeName: v.string(),
    researchAnswers: dataTypeResearchSchema,
  }),
  output: dataTypePlanSchema,
  async run({ harness, data, log }) {
    return {
      output: await designPlan({
        harness,
        log,
        label: 'designer (data type)',
        result: dataTypePlanSchema,
        skipDefault: {
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
        },
        designing: `reference-page plan for: ${data.typeName}`,
        task: `Design the plan for a "${data.typeName}" data type reference page.`,
        templateName: 'data-type-ref-structure',
        templateDoc: dataTypeTemplateDoc,
        guidance: [
          `Decide which optional sections apply, order the constructors, and group EVERY`,
          `public operation into ordered Core Operations categories (a single-method`,
          `category is fine when none fits). For a closed sealed ADT of homogeneous variants,`,
          `plan a single Subtypes/Variants table, not one construction entry per variant.`,
          `The research's "designRationale" decides "motivation": set it true when history gave a real`,
          `reason the type exists, false when the array is empty. A Motivation section with nothing`,
          `behind it is a section the drafter has to invent.`,
        ],
        researchAnswers: data.researchAnswers,
      }),
    };
  },
});

/**
 * Turn the module researcher's findings into a validated plan: the flat-vs-hierarchical
 * layout (via the auto-rule, unless overridden), which module-level sections apply, and the type
 * order.
 */
export const designModulePlan = defineTool({
  name: 'design_module_plan',
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
  output: modulePlanSchema,
  async run({ harness, data, log }) {
    // Recorded here rather than through a callback inside designPlan: every path out of that
    // function converges on its return value, so there is no branch left to forget. An earlier
    // version passed an `onResult` hook and wired it into the skip branch ONLY — the success path
    // recorded nothing, so write_module_overview refused a plan that had in fact been designed.
    // tinytally's first run caught it: design finished at log line 420, the write at 430 was
    // refused twice, and the model then wrote the page by hand.
    const plan = await designPlan({
      harness,
      log,
      label: 'designer (module)',
      result: modulePlanSchema,
      skipDefault: {
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
      designing: `module-reference plan for: ${data.moduleName}`,
      task: `Design the plan for a "${data.moduleName}" module reference page.`,
      templateName: 'module-ref-structure',
      templateDoc: moduleTemplateDoc,
      guidance: [
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
        `Decide which module-level sections apply — "motivation" follows the research's "designRationale":`,
        `true when history gave a real reason the module is factored this way, false when it is empty.`,
        `Organize EVERY type into named groups in reading order.`,
        `For a core-type shape each group is a domain concern the types share (what they do together), e.g.`,
        `for an HTTP module "Routing", "Http Messages", "Endpoints". For a "dsl" shape group by TASK/`,
        `composition concern (recipes) instead — the types still appear (they inform the page) but get NO`,
        `per-type pages. Separately, tag each type "core" (documented comprehensively) or "supporting" (a`,
        `minimal page); this is per-type depth, independent of its group.`,
        `Assign an entry-point/singleton object (e.g. trace/log/metric) to the sub-domain it serves; it`,
        `anchors that sub-domain's index.`,
      ],
      researchAnswers: data.researchAnswers,
    });
    recordModulePlan(data.moduleName, plan);
    return { output: plan };
  },
});

/**
 * Turn the researcher's answers into a validated, strictly linear section plan. Reliability-critical:
 * the output shape is enforced so the writer stage always receives a well-formed plan.
 */
export const designTutorialPlan = defineTool({
  name: 'design_tutorial_plan',
  description: 'Turn deep-research answers into a validated, linear tutorial section plan.',
  harness: true,
  input: v.object({
    topic: v.string(),
    researchAnswers: tutorialResearchSchema,
  }),
  output: tutorialPlanSchema,
  async run({ harness, data, log }) {
    return {
      output: await designPlan({
        harness,
        log,
        label: 'designer (tutorial)',
        result: tutorialPlanSchema,
        skipDefault: {
          learningObjectives: [],
          prerequisites: [],
          sections: [],
          coreInsight: '(skipped — phase already done)',
        },
        designing: `tutorial plan for: ${data.topic}`,
        task: `Design a learning-oriented tutorial plan for "${data.topic}".`,
        templateName: 'tutorial-structure',
        templateDoc: tutorialTemplateDoc,
        guidance: [],
        researchAnswers: data.researchAnswers,
      }),
    };
  },
});
