import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { runReviewPhase } from '../workflows/phases/review.js';

export const reviewDocsAction = defineAction({
  name: 'review_docs',
  description:
    'Run a critic → fix review loop on a just-written documentation article: spawn a critic to find accuracy, ' +
    'completeness, consistency, and clarity issues, then a fixer to apply the actionable ones. ' +
    'Only call this when the calling workflow prompt explicitly instructs you to, using the exact parameters it gives you.',
  input: v.object({
    outputPath: v.string(),
    projectRoot: v.string(),
    typeName: v.string(),
    sourceFiles: v.optional(v.array(v.string())),
    relatedDocs: v.optional(v.array(v.string())),
  }),
  async run({ harness, input, log }) {
    log.info('review_docs invoked', { typeName: input.typeName, outputPath: input.outputPath });
    const result = await runReviewPhase(harness, input);
    return { ...result };
  },
});
