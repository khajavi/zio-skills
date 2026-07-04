import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { runBuildVerifyPhase } from '../workflows/phases/build-verify.js';

export const buildVerifyDocsAction = defineAction({
  name: 'build_verify_docs',
  description:
    'Build the documentation website and, for Scala projects, run `sbt check` as a lint gate, ' +
    'auto-fixing build errors over a few rounds. ' +
    'Only call this when the calling workflow prompt explicitly instructs you to, using the exact parameters it gives you.',
  input: v.object({
    docsDir: v.string(),
    projectRoot: v.string(),
    maxRounds: v.optional(v.number()),
  }),
  async run({ harness, input, log }) {
    log.info('build_verify_docs invoked', { docsDir: input.docsDir });
    const result = await runBuildVerifyPhase(harness, null, {
      docsDir: input.docsDir,
      projectRoot: input.projectRoot,
      sessionName: 'build-verify-docs',
      skipPhases: [],
      maxRounds: input.maxRounds,
    });
    return { ...result };
  },
});
