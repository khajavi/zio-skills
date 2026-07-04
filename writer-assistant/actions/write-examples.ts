import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { runExamplesPhase } from '../workflows/phases/examples.js';

export const writeExamplesAction = defineAction({
  name: 'write_examples',
  description:
    'Generate, compile, run, format, and embed companion Scala example files into a documentation article. ' +
    'Only call this when the calling workflow prompt explicitly instructs you to, using the exact parameters it gives you.',
  input: v.object({
    projectRoot: v.string(),
    moduleName: v.string(),
    topic: v.string(),
    docType: v.picklist(['data-type-ref', 'tutorial', 'how-to-guide', 'module-ref']),
    outputDocPath: v.optional(v.string()),
    packageName: v.optional(v.string()),
    parentModule: v.optional(v.string()),
  }),
  async run({ harness, input, log }) {
    log.info('write_examples invoked', { moduleName: input.moduleName, docType: input.docType });
    const result = await runExamplesPhase(harness, input);
    return { ...result };
  },
});
