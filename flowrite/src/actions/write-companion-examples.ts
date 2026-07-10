import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { isPhaseSkipped } from '../shared/skip-phases.ts';

export const writeCompanionExamplesOutput = v.object({
  skipped: v.boolean(),
  summary: v.string(),
});

/**
 * Build companion example files for a finished tutorial, then verify they
 * compile and run. Checks the skip list before ever delegating — see
 * review-tutorial.ts (action) for why this check must live in code, not
 * only as prose in tutorial-writer.md.
 */
export const writeCompanionExamples = defineAction({
  name: 'write_companion_examples',
  description: 'Build companion example files for a tutorial and verify they compile and run.',
  input: v.object({
    tutorialPath: v.pipe(v.string(), v.description('Path to the tutorial markdown, e.g. docs/guides/scope.md')),
  }),
  output: writeCompanionExamplesOutput,
  async run({ harness, input, log }) {
    if (isPhaseSkipped('write-examples')) {
      log.info('Skipping companion examples (skipPhases)');
      return { skipped: true, summary: 'Skipped by request.' };
    }

    log.info(`Building companion examples for: ${input.tutorialPath}`);
    const session = await harness.session();
    // Delegates to the examples_builder subagent — see design-tutorial-structure.ts
    // for why bare harness.session() on the calling agent is unsafe here.
    const { data } = await session.task(
      `Build companion examples for the tutorial at ${input.tutorialPath}. Read the tutorial ` +
        `and copy its code blocks: one standalone runnable example per major concept, plus the ` +
        `"## Putting It Together" example copied verbatim. Then verify with compile_examples ` +
        `and run_example (examples must print meaningful output).`,
      { agent: 'examples_builder', result: writeCompanionExamplesOutput },
    );
    return data;
  },
});
