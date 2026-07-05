import { defineAction } from '@flue/runtime';
import * as v from 'valibot';

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
    structure: v.pipe(v.string(), v.description('The section plan from design_tutorial_structure')),
    researchAnswers: v.pipe(
      v.string(),
      v.description(
        'The full, unmodified research answers from tutorial_researcher. Ground every ' +
          'import, type signature, method name, and code example in this — never use ' +
          'general Scala/ZIO/library knowledge for a fact that could instead come from here.',
      ),
    ),
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
        `examples; never substitute general knowledge):`,
        input.researchAnswers,
        ``,
        `Structure to follow exactly:`,
        input.structure,
      ].join('\n'),
      { agent: 'tutorial_drafter', result: contentSchema },
    );

    await harness.fs.writeFile(path, data.content);
    return { path, content: data.content };
  },
});
