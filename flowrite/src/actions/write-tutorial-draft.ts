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
  }),
  output: v.object({ path: v.string(), content: v.string() }),
  async run({ harness, input, log }) {
    const path = `docs/guides/${input.id}.md`;
    log.info(`Writing tutorial draft: ${path}`);

    const session = await harness.session();
    // Delegates to the tutorial_drafter subagent — see design-tutorial-structure.ts
    // for why bare harness.session() on the calling agent is unsafe here.
    const response = await session.task(
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
        ``,
        `Topic: ${input.topic}`,
        `Structure to follow exactly:`,
        input.structure,
      ].join('\n'),
      { agent: 'tutorial_drafter' },
    );

    await harness.fs.writeFile(path, response.text);
    return { path, content: response.text };
  },
});
