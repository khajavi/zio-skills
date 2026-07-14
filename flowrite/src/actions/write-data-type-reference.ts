import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { dataTypeResearchSchema } from './research-data-type.ts';
import { dataTypeStructureSchema } from './design-data-type-structure.ts';
import { isPhaseSkipped } from '../shared/skip-phases.ts';
// The data-type-ref-structure skill's content, injected into the generic drafter's
// task (skills can't vary per session.task call). Same single-source-of-truth
// split as writing-style/references/rules.md; the SKILL.md points here.
import dataTypeStructureDoc from '../skills/data-type-ref-structure/references/structure.md' with { type: 'markdown' };

/** Kebab-case a type name for the filename: "NonEmptyChunk" -> "non-empty-chunk". */
export function toKebabCase(typeName: string): string {
  return typeName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * Generate the reference-page markdown and write it to docs/reference/<type>.md.
 * Writing goes through harness.fs (out-of-band) so the file lands deterministically
 * rather than depending on the model choosing to call a filesystem tool. Mirrors
 * write-tutorial-draft.ts, but for the reference-page shape and output path.
 */
export const writeDataTypeReference = defineAction({
  name: 'write_data_type_reference',
  description: 'Write the data type reference markdown to docs/reference/<type>.md and return its path and content.',
  input: v.object({
    structure: dataTypeStructureSchema,
    researchAnswers: dataTypeResearchSchema,
  }),
  output: v.object({ path: v.string(), content: v.string() }),
  async run({ harness, input, log }) {
    const id = toKebabCase(input.researchAnswers.typeName);
    const path = `docs/reference/${id}.md`;

    // Resume support: the page already exists on disk — return it as-is so later
    // phases get the real path/content.
    if (isPhaseSkipped('write')) {
      log.info(`Skipping draft (skipPhases) — using existing ${path}`);
      return { path, content: await harness.fs.readFile(path) };
    }

    log.info(`Writing data type reference: ${path}`);

    const session = await harness.session();
    // Delegates to the generic drafter subagent — see design-tutorial-structure.ts
    // for why bare harness.session() on the calling agent is unsafe here. The
    // reference-page template + result schema are supplied at the call site.
    const contentSchema = v.object({
      title: v.pipe(v.string(), v.description('The type name, e.g. "Chunk" — this is the page title')),
      description: v.pipe(
        v.string(),
        v.minLength(50),
        v.maxLength(150),
        v.description('50-150 characters describing the reference page purpose'),
      ),
      keywords: v.pipe(
        v.array(v.string()),
        v.minLength(3),
        v.maxLength(7),
        v.description(
          'Search keywords: compound phrases grounded in this type and its concepts — ' +
            'e.g. "Immutable Sequence", "Functional Optics". Never a bare generic word.',
        ),
      ),
      body: v.pipe(
        v.string(),
        v.description(
          'The reference body only — no frontmatter, no leading ---. Starts directly with the ' +
            'opening definition prose (NO heading). No preamble, no surrounding code fence.',
        ),
      ),
    });
    const { data } = await session.task(
      [
        `Write a complete ZIO data type reference page as Docusaurus markdown.`,
        ``,
        `Follow this data-type-ref-structure template and its drafting rules exactly:`,
        ``,
        dataTypeStructureDoc,
        ``,
        `Structural plan to follow exactly — the optional sections to include, the`,
        `construction order, and the Core Operations category grouping are already`,
        `decided; write the page to match this plan:`,
        JSON.stringify(input.structure),
        ``,
        `Research answers (ground every fact in this — real signatures, imports, and examples;`,
        `never substitute general knowledge; groundingDetail carries verbatim detail to copy exactly.`,
        `Document EVERY constructor and core operation listed):`,
        JSON.stringify(input.researchAnswers),
      ].join('\n'),
      { agent: 'drafter', result: contentSchema },
    );

    const frontmatter = [
      '---',
      `id: ${id}`,
      `title: ${JSON.stringify(data.title)}`,
      `description: ${JSON.stringify(data.description)}`,
      `keywords: [${data.keywords.map((k) => JSON.stringify(k)).join(', ')}]`,
      '---',
    ].join('\n');
    // Blank line between frontmatter and body (Docusaurus/MDX convention; a body
    // glued directly to the closing --- renders wrong). Strip any leading newlines
    // the model added so the separation is always exactly one blank line.
    const content = `${frontmatter}\n\n${data.body.replace(/^\n+/, '')}`;

    await harness.fs.writeFile(path, content);
    return { path, content };
  },
});
