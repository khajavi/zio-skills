import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { structureSchema } from './design-tutorial-structure.ts';
import { researchSchema } from './research-tutorial-topic.ts';

/**
 * Generate the tutorial markdown and write it to docs/guides/<id>.md.
 * Writing goes through harness.fs (out-of-band) so the file lands deterministically
 * rather than depending on the model choosing to call a filesystem tool.
 */
export const writeTutorialDraft = defineAction({
  name: 'write_tutorial_draft',
  description: 'Write the tutorial markdown to docs/guides/<id>.md and return its path and content.',
  input: v.object({
    id: v.pipe(v.string(), v.description('kebab-case tutorial id; matches the filename')),
    topic: v.string(),
    structure: structureSchema,
    researchAnswers: researchSchema,
  }),
  output: v.object({ path: v.string(), content: v.string() }),
  async run({ harness, input, log }) {
    const path = `docs/guides/${input.id}.md`;
    log.info(`Writing tutorial draft: ${path}`);

    const session = await harness.session();
    // Delegates to the tutorial_drafter subagent — see design-tutorial-structure.ts
    // for why bare harness.session() on the calling agent is unsafe here.
    // Uses a result schema (not response.text) so the model returns content
    // through the structured channel instead of a chat reply — that channel
    // doesn't carry the "narrate, then fence the deliverable" habit that
    // corrupted the written file with a stray preamble/code fence.
    const contentSchema = v.object({
      content: v.pipe(
        v.string(),
        v.description(
          'The complete raw markdown file — starts with the frontmatter --- on the ' +
            'very first line. No prose before it, no surrounding code fence.',
        ),
      ),
      keywords: v.pipe(
        v.array(v.string()),
        v.minLength(3),
        v.maxLength(7),
        v.description(
          'Search keywords/phrases for the frontmatter of the document. Each item is a compound ' +
            'phrase (1-2 words) grounded in this tutorial\'s actual terminology and its primary concepts — ' +
            'e.g. "Error Handling", "Fiber Composition", "Software Transactional Memory", "Functional Optics"',
        ),
      ),
    });
    const { data } = await session.task(
      [
        `Write a complete learning-oriented tutorial as Docusaurus markdown.`,
        ``,
        `Frontmatter must be:`,
        `---`,
        `id: ${input.id}`,
        `title: "<a warm, specific tutorial title>"`,
        `description: "<50-150 characters describing the page purpose>"`,
        `keywords: ["<3-7 keywords>"]`,
        `---`,
        `content must start with the '---' above as its literal first characters.`,
        ``,
        `Topic: ${input.topic}`,
        ``,
        `Research answers (ground every fact in this — imports, signatures, real`,
        `examples; never substitute general knowledge; groundingDetail carries the`,
        `verbatim code/signatures to copy exactly):`,
        JSON.stringify(input.researchAnswers),
        ``,
        `Structure to follow exactly:`,
        JSON.stringify(input.structure),
      ].join('\n'),
      { agent: 'tutorial_drafter', result: contentSchema },
    );

    const keywordsLine = `keywords: [${data.keywords.map((k) => JSON.stringify(k)).join(', ')}]`;
    const content = data.content.replace(/^keywords:\s*\[.*\]\s*$/m, keywordsLine);

    await harness.fs.writeFile(path, content);
    return { path, content };
  },
});
