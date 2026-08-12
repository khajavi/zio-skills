import { type FlueHarness, type FlueLogger, defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { dataTypeResearchSchema, moduleResearchSchema, tutorialResearchSchema } from './research.ts';
import { dataTypeStructureSchema, moduleStructureSchema, tutorialStructureSchema } from './design-doc-structure.ts';
import { isPhaseSkipped } from '../shared/skip-phases.ts';
import { buildFrontmatter, withFrontmatter } from '../shared/frontmatter.ts';
import { authorHint } from '../shared/author-hint.ts';
import { delegate } from '../shared/delegate.ts';
// Each kind's structure template, injected into the generic drafter's task (a subagent's skills
// cannot vary per delegated task). Same single-source-of-truth split as writing-style rules: the
// SKILL.md files point here.
import dataTypeStructureDoc from '../skills/data-type-ref-structure/references/structure.md';
import moduleStructureDoc from '../skills/module-ref-structure/references/structure.md';
import tutorialStructureDoc from '../skills/tutorial-structure/references/structure.md';
// TEMPORARY: flue does not package nested skill files, so the drafter cannot read
// writing-style/references/rules.md at runtime (read_skill_resource 404s) — see
// https://github.com/withastro/flue/discussions/100. We inject the rules into the drafter prompt at
// compile time instead. REVERT once flue supports nested skills: drop this import + injection and let
// the writing-style skill supply the rules.
import writingStyleRules from '../skills/writing-style/references/rules.md';

/**
 * The write phase: draft one page and put it on disk.
 *
 * ONE body, THREE tools, for the reasons given in design-doc-structure.ts — the inputs embed that
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
 * reason design-doc-structure.ts explains: the calling agent's own write tool is visible to whoever
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
    opts.log.info(`Skipping draft (skipPhases) — using existing ${opts.path}`);
    return { path: opts.path, content: await opts.harness.sandbox.readFile(opts.path) };
  }

  opts.log.info(`Writing ${opts.writing}: ${opts.path}`);
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
const followTemplate = (task: string, templateName: string, structureDoc: string): string[] => [
  task,
  ``,
  `Follow this ${templateName} template and its drafting rules exactly:`,
  ``,
  structureDoc,
];

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
    structure: dataTypeStructureSchema,
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
            dataTypeStructureDoc,
          ),
          ``,
          ...styleRules(),
          ``,
          `Structural plan to follow exactly — the optional sections to include, the`,
          `construction order, and the Core Operations category grouping are already`,
          `decided; write the page to match this plan:`,
          JSON.stringify(data.structure),
          ``,
          `Research answers (ground every fact in this — real signatures, imports, and examples;`,
          `never substitute general knowledge; groundingDetail carries verbatim detail to copy exactly.`,
          `Document EVERY constructor and core operation listed):`,
          JSON.stringify(data.researchAnswers),
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
    structure: moduleStructureSchema,
    researchAnswers: moduleResearchSchema,
  }),
  output: v.object({ path: v.string(), content: v.string() }),
  async run({ harness, data, log }) {
    const moduleKebab = toKebabCase(data.researchAnswers.moduleName);
    const isFlat = data.structure.layout === 'flat';
    // flat -> docs/reference/<module>.md (id = <module>); hierarchical -> the module dir's index
    // (id = index) with subpages alongside it.
    const layoutInstruction =
      data.structure.layout === 'hierarchical'
        ? [
            `This is a HIERARCHICAL module reference: write ONLY the index.md — the module-level narrative`,
            `plus an Overview that introduces each core type in 2-3 sentences and links to its subpage with`,
            `a relative path "./<type-kebab>.md". Do NOT document the types' full APIs here; each type gets`,
            `its own subpage written separately.`,
          ]
        : data.structure.shape === 'dsl'
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
        writing: `module overview (${data.structure.layout})`,
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
            moduleStructureDoc,
          ),
          ``,
          ...layoutInstruction,
          ``,
          ...styleRules(),
          ``,
          `Structural plan to follow exactly (layout, which sections to include, and the type order are`,
          `already decided; write the page to match this plan):`,
          JSON.stringify(data.structure),
          ``,
          `Research answers (ground every fact and relationship in this — real signatures, imports, and`,
          `examples; never substitute general knowledge; groundingDetail carries verbatim detail to copy`,
          `exactly. The "How They Work Together" section MUST reflect the real "relationships" here):`,
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
    structure: tutorialStructureSchema,
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
            tutorialStructureDoc,
          ),
          ``,
          ...styleRules(),
          ``,
          `Topic: ${data.topic}`,
          ``,
          `Research answers (ground every fact in this — imports, signatures, real`,
          `examples; never substitute general knowledge; groundingDetail carries the`,
          `verbatim code/signatures to copy exactly):`,
          JSON.stringify(data.researchAnswers),
          ``,
          `Section plan to follow exactly:`,
          JSON.stringify(data.structure),
          ``,
          DESCRIPTION_LENGTH,
        ],
      }),
    };
  },
});
