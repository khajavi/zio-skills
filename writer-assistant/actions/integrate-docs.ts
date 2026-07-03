import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { buildIntegratePrompt } from '../workflows/phases/integrate.js';

export const integrateDocsAction = defineAction({
  name: 'integrate_docs',
  description:
    'Wire a just-written documentation article into the docs site structure: sidebars.js, docs/index.md, ' +
    'and reciprocal cross-references from related pages. ' +
    'Only call this when the calling workflow prompt explicitly instructs you to, using the exact parameters it gives you.',
  input: v.object({
    projectRoot: v.string(),
    outputFileName: v.string(),
    topic: v.string(),
    docType: v.picklist(['tutorial', 'how-to-guide', 'data-type-ref', 'module-ref']),
  }),
  async run({ harness, input, log }) {
    log.info('integrate_docs invoked', { docType: input.docType, topic: input.topic });
    const session = await harness.session(`integrate-${input.docType}`);
    const result = await session.prompt(buildIntegratePrompt(input));
    return { text: typeof result === 'string' ? result : String((result as any)?.text ?? '') };
  },
});
