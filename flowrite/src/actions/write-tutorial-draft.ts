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
    const response = await session.prompt(
      [
        `Write a complete learning-oriented tutorial as Docusaurus markdown.`,
        `Load and follow the writing-style skill (prose, Scala 2.13 default, @VERSION@)`,
        `and the mdoc-conventions skill (mdoc modifiers, admonitions).`,
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
        ``,
        `Rules: one concept per section; explain the concept before its code;`,
        `annotate every code block line-by-line; show intermediate output; warm tone;`,
        `never branch. End with "What You've Learned" and "Where to Go Next".`,
        `Output ONLY the markdown file content, nothing else.`,
      ].join('\n'),
    );

    await harness.fs.writeFile(path, response.text);
    return { path, content: response.text };
  },
});
