import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { runStylePhase } from '../workflows/phases/style.js';

export const styleDocsAction = defineAction({
  name: 'style_docs',
  description:
    'Run a check -> fix loop on a just-written documentation article for prose style violations ' +
    '(mechanical + LLM judgment checks against the docs-writing-style rules), then apply fixes. ' +
    'Only call this when the calling workflow prompt explicitly instructs you to, using the exact parameters it gives you.',
  input: v.object({
    outputPath: v.string(),
    projectRoot: v.string(),
    typeName: v.string(),
    maxRounds: v.optional(v.number()),
  }),
  async run({ harness, input, log }) {
    log.info('style_docs invoked', { typeName: input.typeName, outputPath: input.outputPath });
    const result = await runStylePhase(harness, input);
    return { ...result };
  },
});
