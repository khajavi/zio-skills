import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { createRunMdoc } from '../tools/run_mdoc.js';
import { buildVerifyPrompt } from '../workflows/phases/verify.js';

export const verifyDocsAction = defineAction({
  name: 'verify_docs',
  description:
    'Verify a just-written documentation article: structure compliance, mdoc compilation to zero errors, style checks, and checklist review. ' +
    'Only call this when the calling workflow prompt explicitly instructs you to, using the exact parameters it gives you.',
  input: v.object({
    projectRoot: v.string(),
    changedFiles: v.array(v.string()),
    topic: v.string(),
    resolvedOutputPath: v.string(),
    docType: v.picklist(['tutorial', 'how-to-guide', 'data-type-ref', 'module-ref']),
  }),
  async run({ harness, input, log }) {
    log.info('verify_docs invoked', { docType: input.docType, topic: input.topic });
    const session = await harness.session(`verify-${input.docType}`);
    const result = await session.prompt(buildVerifyPrompt(input), {
      tools: [createRunMdoc(input.projectRoot)],
    });
    return { text: typeof result === 'string' ? result : String((result as any)?.text ?? '') };
  },
});
