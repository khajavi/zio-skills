import { defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';
import tutorialWriter from '../agents/tutorial-writer.ts';

/**
 * Finite wrapper around the tutorial-writer agent for CI, scheduled, or batch
 * runs. The agent resolves its repo checkout from ZIO_REPO_PATH (set per run);
 * this workflow just hands it the topic and returns the produced file path.
 */
export const route: WorkflowRouteHandler = async (_c, next) => next();

export default defineWorkflow({
  agent: tutorialWriter,
  input: v.object({
    topic: v.pipe(v.string(), v.description('Tutorial title or topic description')),
  }),
  output: v.object({ path: v.string(), summary: v.string() }),
  async run({ harness, input }) {
    const session = await harness.session();
    const { data } = await session.prompt(
      `Write a complete, compile-verified tutorial for: ${input.topic}. ` +
        `Run the full flow (research → design → write → examples → mdoc verify → integrate → review). ` +
        `Report the final tutorial file path and a one-line summary.`,
      {
        result: v.object({ path: v.string(), summary: v.string() }),
      },
    );
    return data;
  },
});
