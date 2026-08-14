import { type FlueHarness, type FlueLogger, defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { dataTypeResearchSchema, moduleResearchSchema, tutorialResearchSchema } from './research.ts';
import { dataTypePlanSchema, modulePlanSchema, tutorialPlanSchema } from './design-doc-plan.ts';
import { isPhaseSkipped } from '../../runtime/skip-phases.ts';
import { authorHint } from '../../runtime/run-context.ts';
import { delegate } from '../../runtime/delegate.ts';
// Each kind's structure template, injected into the generic drafter's task (a subagent's skills
// cannot vary per delegated task). Same single-source-of-truth split as writing-style rules: the
// SKILL.md files point here.
import dataTypeTemplateDoc from '../../skills/data-type-ref-structure/references/structure.md';
import moduleTemplateDoc from '../../skills/module-ref-structure/references/structure.md';
import tutorialTemplateDoc from '../../skills/tutorial-structure/references/structure.md';
// The writing-style rules, injected into the drafter prompt at compile time.
//
// This was a workaround: flue beta.9 did not package nested skill files, so the drafter could not read
// writing-style/references/rules.md at runtime. That is fixed — 2.0.3 packages a skill's whole
// directory and adds `read_skill_resource`, verified with a probe on 2026-08-12 — but the injection
// stays, deliberately. The whole injected corpus across a worst-case run is ~9,500 tokens, about $0.01,
// while activating a skill and reading a resource costs three tool round-trips that each re-send the
// delegate's accumulated context. The file remains the single source of truth: it is imported here,
// never copied.
import writingStyleRules from '../../skills/writing-style/references/rules.md';
import { note } from '../../runtime/log.ts';
import { operationNames, planShape, requireModulePlan, requireResearch } from './phase-ledger.ts';

/**
 * The write phase: draft one page and put it on disk.
 *
 * ONE body, THREE tools, for the reasons given in design-doc-plan.ts — the inputs embed that
 * kind's plan and research schemas verbatim, and `KINDS` mounts only the write tools a run can use
 * (a module run mounts two on purpose: the module page, plus `write_data_type_reference` again for
 * each hierarchical subpage).
 *
 * More was shared here than in the other two phases. Every kind resumes the same way, asks the
 * drafter for the same four-field result, builds frontmatter from it the same way, and writes through
 * `harness.sandbox` for the same reason — all of that now lives in `writeDoc`. What differs is the
 * output path, the template, and the prompt.
 */

/** Kebab-case a type name for the filename: "NonEmptyChunk" -> "non-empty-chunk". */
export function toKebabCase(typeName: string): string {
  return typeName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * Build a Docusaurus/MDX YAML frontmatter block for a documentation page.
 * `keywords` is emitted as a YAML block list (one `- item` per line), not an
 * inline flow array — Docusaurus expects the block form for its keyword tags.
 */
function buildFrontmatter(fields: {
  id: string;
  title: string;
  description: string;
  keywords: string[];
}): string {
  const keywords = fields.keywords.length
    ? `keywords:\n${fields.keywords.map((k) => `  - ${JSON.stringify(k)}`).join('\n')}`
    : 'keywords: []';
  return [
    '---',
    `id: ${fields.id}`,
    `title: ${JSON.stringify(fields.title)}`,
    `description: ${JSON.stringify(fields.description)}`,
    keywords,
    '---',
  ].join('\n');
}

/**
 * Join a frontmatter block to a page body with exactly one blank line between
 * them. A body glued directly to the closing `---` renders wrong; strip any
 * leading newlines the model added so the separation is always one blank line.
 */
function withFrontmatter(frontmatter: string, body: string): string {
  return `${frontmatter}\n\n${body.replace(/^\n+/, '')}`;
}

/**
 * What the drafter must return, with the per-kind wording of three fields.
 *
 * Every kind wants the same four fields under the same constraints — a title, a 50-150 character
 * description, 3-6 keywords, and a body with no frontmatter and no surrounding fence. Only the
 * guidance text differs, so only the guidance text is a parameter.
 *
 * A result schema rather than `response.text` on purpose: the structured channel does not carry the
 * "narrate, then fence the deliverable" habit that once corrupted a written file with a stray
 * preamble and code fence.
 */
function draftSchema(guidance: { title: string; purpose: string; keywords: string; body: string }) {
  return v.object({
    title: v.pipe(v.string(), v.description(guidance.title)),
    description: v.pipe(
      v.string(),
      v.minLength(50),
      v.maxLength(150),
      v.description(`50-150 characters describing the ${guidance.purpose}`),
    ),
    keywords: v.pipe(
      v.array(v.string()),
      v.minLength(3),
      v.maxLength(7),
      v.description(guidance.keywords),
    ),
    body: v.pipe(v.string(), v.description(guidance.body)),
  });
}

/**
 * Draft one page through the generic `drafter` subagent and write it to disk.
 *
 * Writing goes through `harness.sandbox` (out-of-band) so the file lands deterministically rather
 * than depending on the model choosing to call a filesystem tool. The delegation matters for the
 * reason design-doc-plan.ts explains: the calling agent's own write tool is visible to whoever
 * drafts, so drafting in that conversation lets it call itself.
 */
async function writeDoc(opts: {
  harness: FlueHarness;
  log: FlueLogger;
  /** Log/delegation label, e.g. 'drafter (tutorial)'. */
  label: string;
  /** Where the page goes, repo-relative. */
  path: string;
  /** Docusaurus frontmatter id — the kebab page name, or 'index' for a hierarchical module. */
  id: string;
  /** What the phase announces it is writing, e.g. 'data type reference'. */
  writing: string;
  guidance: Parameters<typeof draftSchema>[0];
  /** The task lines; `authorHint()` is appended. */
  prompt: string[];
}): Promise<{ path: string; content: string }> {
  // Resume support: the page already exists on disk — return it as-is so later phases get the real
  // path/content. Fails loudly if the id does not match an existing file.
  if (isPhaseSkipped('write')) {
    note(opts.log, `Skipping draft (skipPhases) — using existing ${opts.path}`);
    return { path: opts.path, content: await opts.harness.sandbox.readFile(opts.path) };
  }

  note(opts.log, `Writing ${opts.writing}: ${opts.path}`);
  const draft = await delegate({
    harness: opts.harness,
    log: opts.log,
    label: opts.label,
    role: 'drafter',
    result: draftSchema(opts.guidance),
    prompt: opts.prompt.join('\n') + authorHint(),
  });

  const content = withFrontmatter(
    buildFrontmatter({
      id: opts.id,
      title: draft.title,
      description: draft.description,
      keywords: draft.keywords,
    }),
    draft.body,
  );
  await opts.harness.sandbox.writeFile(opts.path, content);
  return { path: opts.path, content };
}

/** The four lines every drafter prompt opens with: what to write, and the template to follow. */
const followTemplate = (task: string, templateName: string, templateDoc: string): string[] => [
  task,
  ``,
  `Follow this ${templateName} template and its drafting rules exactly:`,
  ``,
  templateDoc,
];

/** What `planBlock` and `isSubpage` need from a `write_data_type_reference` call. */
interface DataTypePageInput {
  plan?: v.InferOutput<typeof dataTypePlanSchema>;
  moduleContext?: string;
}

/**
 * True when this page is a module reference's per-type subpage rather than a standalone reference.
 *
 * `moduleContext` is the marker: set on every subpage call in `write-module-ref-turn5`, absent on
 * every standalone data-type call, and a caller has no reason to send it otherwise. `outputDir` is
 * not a reliable marker — a standalone run may legitimately redirect its output.
 */
const isSubpage = (data: DataTypePageInput): boolean => data.moduleContext !== undefined;

/**
 * The plan section of a drafter prompt: the plan when one was designed, an explicit statement of its
 * absence otherwise.
 *
 * Takes the whole input rather than a plan, so the discard rule and the prompt text cannot disagree.
 * They did, briefly, while this was being written: the branch tested the filtered value and the body
 * serialized the unfiltered one, which `tsc` cannot catch because both are in scope and well-typed.
 * One function over one argument removes the second variable that made the mistake possible.
 *
 * A module subpage has no design phase behind it — `KINDS.module.tools` mounts no
 * `design_data_type_plan` — so any plan arriving with one was composed by the model, not designed.
 * See the `plan` field's own comment for what that cost in write-module-ref-turn3.
 */
export function planBlock(data: DataTypePageInput): string[] {
  const plan = isSubpage(data) ? undefined : data.plan;
  return plan
    ? [
        `Plan to follow exactly — the optional sections to include, the`,
        `construction order, and the Core Operations category grouping are already`,
        `decided; write the page to match this plan:`,
        JSON.stringify(plan),
      ]
    : [
        // Do not invite the drafter to reconstruct a plan: the template above already specifies the
        // structure, and asking for one back would re-create the improvisation this removes.
        `No plan accompanies this page: decide the section applicability, the construction`,
        `order and the Core Operations grouping yourself, from the template above and the`,
        `research below. Include a section when the research has real content for it, and`,
        `omit it otherwise.`,
      ];
}

/** The injected writing-style rules block. TEMP — see the `writingStyleRules` import. */
const styleRules = (): string[] => [
  `Writing-style rules — apply every rule to the prose you write:`,
  ``,
  writingStyleRules,
];

/** The closing constraint the `description` field's own guidance repeats. */
const DESCRIPTION_LENGTH = `The finish result's "description" must be 50-150 characters.`;

/** Write the reference page for one data type to docs/reference/<type>.md (or a module subpage). */
export const writeDataTypeReference = defineTool({
  name: 'write_data_type_reference',
  description: 'Write the data type reference markdown to docs/reference/<type>.md and return its path and content.',
  harness: true,
  input: v.object({
    /**
     * Optional, and that is a bug fix rather than a convenience.
     *
     * A data-type run mounts `design_data_type_plan`, so a plan always arrives. A MODULE run does
     * not mount it — `KINDS.module.tools` has never included it — yet mounts this tool for its
     * per-type subpages. While `plan` was required with no way to produce one, the model satisfied
     * the schema by inventing a plan from whatever was in its context, and once in fifteen calls it
     * reached for the wrong type's: `write-module-ref-turn3` handed the drafter `Lens`'s research
     * with `Iso`'s plan, naming `to`, `from`, `reverse` and `asLens` — four methods Lens does not
     * have. Nothing caught it, because `dataTypePlanSchema` validates the shape and never that the
     * plan describes the same type as the research beside it.
     *
     * Optional, but optionality alone changed nothing, and `run()` is where the fix actually lives.
     * `v.optional` is a permission, not a prohibition: the field is still advertised in the schema,
     * so a model that has just read the research fills it in regardless. Measured on
     * `write-module-ref-turn5`, the run that tested exactly this — 4 of 4 subpage calls supplied a
     * plan, and the present-plan branch of the prompt executed every time. An instruction in
     * module-ref.md telling it to omit the field was ignored, like the "do not cd into the repo"
     * directive that turn20 ignored 38 times in 107 bash calls.
     *
     * So `run()` discards it for subpages. Optional stays because the schema must permit what the
     * code then enforces; a required field the tool ignores would be a lie to the model.
     *
     * Mounting a real design phase per subpage is the other fix and costs a design delegation per
     * documented type; see PHASE-HANDOFF-PLAN.md §6.
     */
    plan: v.optional(dataTypePlanSchema),
    researchAnswers: dataTypeResearchSchema,
    // Optional, for module-ref hierarchical subpages. When absent, this tool behaves
    // byte-identically to a standalone data-type-ref run.
    outputDir: v.pipe(
      v.optional(v.string()),
      v.description('Directory for the page instead of the default docs/reference (e.g. "docs/reference/http-model" for a module subpage).'),
    ),
    moduleContext: v.pipe(
      v.optional(v.string()),
      v.description('When this page is a member of a module, how it relates to its sibling types; appended to the drafter prompt for recontextualization.'),
    ),
  }),
  output: v.object({ path: v.string(), content: v.string() }),
  async run({ harness, data, log }) {
    const id = toKebabCase(data.researchAnswers.typeName);

    // The page is drafted from what research_data_type returned, not from what arrived here. The two
    // are normally the same object relayed through the model's conversation; when they are not, the
    // relayed one is the invention — turn5 supplied a whole payload for a type whose research had
    // errored. Throws when nothing is on record, which is the case that used to be filled in.
    const research = requireResearch(data.researchAnswers.typeName);
    const relayed = operationNames(data.researchAnswers).join(', ');
    const recorded = operationNames(research).join(', ');
    if (relayed !== recorded) {
      note(
        log,
        `Relayed research for ${research.typeName} does not match what the research phase returned — ` +
          `drafting from the recorded findings. relayed: [${relayed}]; recorded: [${recorded}]`,
      );
    }

    if (isSubpage(data) && data.plan) {
      // Logged rather than silent for two reasons: a discarded input that leaves no trace cannot be
      // debugged, and the count measures whether the instruction ever starts landing. A run with no
      // discard lines is one where the model finally stopped composing plans it cannot design.
      note(
        log,
        `Discarding the plan sent for ${research.typeName}: a module subpage has no ` +
          `design phase, so this plan was composed rather than designed.`,
      );
    }

    return {
      output: await writeDoc({
        harness,
        log,
        label: 'drafter (data type ref)',
        path: `${data.outputDir ?? 'docs/reference'}/${id}.md`,
        id,
        writing: 'data type reference',
        guidance: {
          title: 'The type name, e.g. "Chunk" — this is the page title',
          purpose: 'reference page purpose',
          keywords:
            '3-6 Title-Case search keywords, one concept each: lead with general domain concepts (usually ' +
            'two words — "Distributed Tracing", "Trace Sampling"), then page-specific concepts/tasks ' +
            '("Custom Sampler"), then the type name ("Sampler"). Never a bag of concatenated identifiers ' +
            '("AlwaysOnSampler AlwaysOffSampler ParentBasedSampler") or a bare generic word.',
          body:
            'The reference body only — no frontmatter, no leading ---. Starts directly with the ' +
            'opening definition prose (NO heading). No preamble, no surrounding code fence.',
        },
        prompt: [
          ...followTemplate(
            `Write a complete ZIO data type reference page as Docusaurus markdown.`,
            'data-type-ref-structure',
            dataTypeTemplateDoc,
          ),
          ``,
          ...styleRules(),
          ``,
          ...planBlock(data),
          ``,
          `Research answers (ground every fact in this — real signatures, imports, and examples;`,
          `never substitute general knowledge; groundingDetail carries verbatim detail to copy exactly.`,
          `historyFindings carries what the repo's own commit and PR history states about this type —`,
          `design reasons, renames, rejected usages, platform and version differences, claimed`,
          `properties. Use each finding wherever it applies: the Motivation / Use Case section, a`,
          `method's caveats, a compatibility note. Never write a motivation no finding supports.`,
          `Document EVERY constructor and core operation listed):`,
          // `research`, never `data.researchAnswers` — see requireResearch above.
          JSON.stringify(research),
          // Module-ref subpage recontextualization: when this type is a member of a module, thread
          // its sibling relationships through each section.
          ...(data.moduleContext
            ? [
                ``,
                `This page is part of a MODULE reference. Recontextualize it to the module: in each section,`,
                `note how this type relates to its sibling types (what it is built with, what it composes`,
                `with, module-level integration). If the context marks this type "supporting" (a helper, or`,
                `rarely used by application code directly), write the MINIMAL supporting page per the`,
                `data-type-ref-structure core-vs-supporting rule; a "core" type gets full depth. Module context:`,
                data.moduleContext,
              ]
            : []),
          ``,
          DESCRIPTION_LENGTH,
        ],
      }),
    };
  },
});

/**
 * Write the module reference's module-level page. For a flat layout this is the WHOLE page — module
 * narrative plus every type documented inline (light per-type coverage). For a hierarchical layout
 * this is only the index.md: the module narrative plus links out to the per-type subpages, which are
 * written separately by the reused write_data_type_reference loop.
 */
export const writeModuleOverview = defineTool({
  name: 'write_module_overview',
  description:
    'Write the module reference module-level page (flat: whole page with inline type sections; hierarchical: index.md narrative + subpage links) and return its path and content.',
  harness: true,
  input: v.object({
    /**
     * Accepted, and then ignored in favour of the plan the design phase recorded.
     *
     * Required rather than optional, unlike `write_data_type_reference.plan`: a module page always has
     * a design phase behind it, so asking for the plan is honest — the tool just does not trust this
     * copy of it. `run()` reads the recorded one and logs any divergence.
     *
     * turn7 is why: this call was issued in the same turn as `design_module_plan`, and the model filled
     * the field itself while the designer was still working. The plan decides `shape`, `layout` and
     * `typeGroups`, so an invented one mis-shapes the index page and every subpage after it.
     */
    plan: modulePlanSchema,
    researchAnswers: moduleResearchSchema,
  }),
  output: v.object({ path: v.string(), content: v.string() }),
  async run({ harness, data, log }) {
    const moduleKebab = toKebabCase(data.researchAnswers.moduleName);

    // The page is written from the plan the design phase produced, not from the one that arrived here.
    // turn7 issued this call in the same turn as design_module_plan and filled the field itself while
    // the designer was still working — 147 seconds before it returned. Throws when design has not run,
    // which is the case that used to be papered over.
    const plan = requireModulePlan(data.researchAnswers.moduleName);
    if (planShape(plan) !== planShape(data.plan)) {
      note(
        log,
        `Relayed plan for ${data.researchAnswers.moduleName} does not match the designed one — ` +
          `writing from the designed plan. relayed: ${planShape(data.plan)}; designed: ${planShape(plan)}`,
      );
    }

    const isFlat = plan.layout === 'flat';
    // flat -> docs/reference/<module>.md (id = <module>); hierarchical -> the module dir's index
    // (id = index) with subpages alongside it.
    const layoutInstruction =
      plan.layout === 'hierarchical'
        ? [
            `This is a HIERARCHICAL module reference: write ONLY the index.md — the module-level narrative`,
            `plus an Overview that introduces each core type in 2-3 sentences and links to its subpage with`,
            `a relative path "./<type-kebab>.md". Do NOT document the types' full APIs here; each type gets`,
            `its own subpage written separately.`,
          ]
        : plan.shape === 'dsl'
          ? [
              `This is a DSL module reference: write ONE page in a single file, organized BY TASK/composition`,
              `— sections are recipes ("Building X", "Combining Y and Z") showing how the types compose to`,
              `solve the domain problem. Use the plan's typeGroups as the task/recipe outline. Do NOT add a`,
              `per-type "### <TypeName>" reference section and do NOT create separate files — the types appear`,
              `inside the recipes, not as their own sections.`,
            ]
          : [
              `This is a FLAT module reference: write the WHOLE page in one file. After the module-level`,
              `sections, document EVERY type from the plan's typeGroups inline, organized under each group's`,
              `"## <label>" heading with types as "### <TypeName>" — a "core" type gets the lighter per-type`,
              `section shape (group operations concisely, one example per group), a "supporting" type gets a`,
              `minimal entry (role + one usage example). Do not create separate files.`,
            ];

    return {
      output: await writeDoc({
        harness,
        log,
        label: 'drafter (module overview)',
        path: isFlat ? `docs/reference/${moduleKebab}.md` : `docs/reference/${moduleKebab}/index.md`,
        id: isFlat ? moduleKebab : 'index',
        writing: `module overview (${plan.layout})`,
        guidance: {
          title: 'The module title, e.g. "HTTP Model" — this is the page title',
          purpose: 'module reference purpose',
          keywords:
            '3-6 Title-Case search keywords, one concept each: general domain concepts (usually two words) + page-specific concepts + the module and its main type names. Not concatenated API identifiers or bare generic words.',
          body:
            'The page body only — no frontmatter, no leading ---. Starts directly with the opening ' +
            'definition prose (NO heading). No preamble, no surrounding code fence.',
        },
        prompt: [
          ...followTemplate(
            `Write a ZIO MODULE reference page as Docusaurus markdown.`,
            'module-ref-structure',
            moduleTemplateDoc,
          ),
          ``,
          ...layoutInstruction,
          ``,
          ...styleRules(),
          ``,
          `Plan to follow exactly (layout, which sections to include, and the type order are`,
          `already decided; write the page to match this plan):`,
          JSON.stringify(plan),
          ``,
          `Research answers (ground every fact and relationship in this — real signatures, imports, and`,
          `examples; never substitute general knowledge; groundingDetail carries verbatim detail to copy`,
          `exactly. The "How They Work Together" section MUST reflect the real "relationships" here.`,
          `historyFindings carries what the module's commit and PR history states about it — why it is`,
          `factored this way, what moved or was extracted, renames, platform differences. Use each`,
          `finding where it applies, and write no motivation that none of them supports):`,
          JSON.stringify(data.researchAnswers),
          ``,
          DESCRIPTION_LENGTH,
        ],
      }),
    };
  },
});

/** Write the tutorial markdown to docs/guides/<id>.md. */
export const writeTutorialDraft = defineTool({
  name: 'write_tutorial_draft',
  description: 'Write the tutorial markdown to docs/guides/<id>.md and return its path and content.',
  harness: true,
  input: v.object({
    id: v.pipe(
      v.string(),
      v.description(
        'kebab-case tutorial id; matches the filename. Specific to this tutorial\'s actual angle, ' +
          'not a generic single word — e.g. "compositional-fiberref-updates", not "differ".',
      ),
    ),
    topic: v.string(),
    plan: tutorialPlanSchema,
    researchAnswers: tutorialResearchSchema,
  }),
  output: v.object({ path: v.string(), content: v.string() }),
  async run({ harness, data, log }) {
    return {
      output: await writeDoc({
        harness,
        log,
        label: 'drafter (tutorial)',
        path: `docs/guides/${data.id}.md`,
        id: data.id,
        writing: 'tutorial draft',
        guidance: {
          title:
            'A warm, specific tutorial title. A bare type name alone (e.g. "The Differ Data Type") is ' +
            "too vague — name the concept the tutorial actually teaches.",
          purpose: 'page purpose',
          keywords:
            'Search keywords/phrases for the frontmatter of the document. Each item is a compound ' +
            'phrase (1-2 words) grounded in this tutorial\'s actual terminology and its primary concepts — ' +
            'e.g. "Error Handling", "Fiber Composition", "Software Transactional Memory", "Functional Optics". ' +
            'Never a single generic word on its own (e.g. "Composition", "Lens") — always pair it with a ' +
            'qualifier specific to this tutorial.',
          body:
            'The tutorial body only — no frontmatter, no leading ---. Starts directly with the ' +
            'first heading/prose. No preamble, no surrounding code fence.',
        },
        prompt: [
          ...followTemplate(
            `Write a complete learning-oriented tutorial as Docusaurus markdown.`,
            'tutorial-structure',
            tutorialTemplateDoc,
          ),
          ``,
          ...styleRules(),
          ``,
          `Topic: ${data.topic}`,
          ``,
          `Research answers (ground every fact in this — imports, signatures, real`,
          `examples; never substitute general knowledge; groundingDetail carries the`,
          `verbatim code/signatures to copy exactly. historyFindings carries what the`,
          `repo's commit and PR history states about this concept — the motivation, and`,
          `every trap worth warning a learner about; invent neither if it is empty):`,
          JSON.stringify(data.researchAnswers),
          ``,
          `Section plan to follow exactly:`,
          JSON.stringify(data.plan),
          ``,
          DESCRIPTION_LENGTH,
        ],
      }),
    };
  },
});
