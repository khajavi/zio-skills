import { defineWorkflow, observe, type FlueEvent, type WorkflowRouteHandler } from '@flue/runtime';
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
  async run({ harness, input, log }) {
    // Accumulate token/cost across the whole run by summing leaf `turn` events.
    // Per the observability guide, sum model-turn leaves — never operation or
    // compaction roll-ups, whose values overlap.
    const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: 0, turns: 0 };
    const unsubscribe = observe((event: FlueEvent) => {
      if (event.type !== 'turn') return;
      const u = event.response.usage;
      if (!u) return;
      usage.input += u.input;
      usage.output += u.output;
      usage.cacheRead += u.cacheRead;
      usage.cacheWrite += u.cacheWrite;
      usage.totalTokens += u.totalTokens;
      usage.cost += u.cost.total;
      usage.turns += 1;
    });

    try {
      const session = await harness.session();
      const { data } = await session.prompt(
        `Write a complete, compile-verified tutorial for: ${input.topic}. ` +
          `Run the full flow (research → design → write → examples → mdoc verify → integrate → review). ` +
          `Report the final tutorial file path and a one-line summary.`,
        {
          result: v.object({ path: v.string(), summary: v.string() }),
        },
      );
      log.info('write-tutorial token consumption', usage);
      return data;
    } finally {
      unsubscribe();
    }
  },
});
