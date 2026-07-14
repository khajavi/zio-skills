import { defineWorkflow, type AgentDefinition } from '@flue/runtime';
import * as v from 'valibot';
import { trackTokenUsage } from './token-usage.ts';
import { trackComponentUsage } from './component-usage.ts';
import { insightsSchema } from './schemas.ts';
import { withTransientRetry } from './style-loop.ts';

/** Every write-* workflow returns the finished page path, a summary, and the run retrospective. */
const outputSchema = v.object({ path: v.string(), summary: v.string(), insights: insightsSchema });

/** The `skipPhases` input field, shared shape (the description varies per workflow). */
export const skipPhasesField = (description: string) =>
  v.optional(
    v.pipe(v.array(v.picklist(['research', 'design', 'write', 'write-examples', 'integrate', 'review'])), v.description(description)),
  );

/**
 * Shared factory for the finite write-* workflow wrappers (CI/scheduled/batch
 * runs of a docs-writer agent). Every one sets REPO_PATH + SKIP_PHASES from the
 * input, tracks token + component usage across the run, drives the agent with a
 * single top-level prompt, and logs the same three summaries in a finally block.
 * They differ only in their agent, input schema, kick-off prompt, and log label.
 */
export function defineDocsWorkflow<
  TIn extends v.GenericSchema<{ projectPath: string; skipPhases?: readonly string[] | undefined }>,
>(opts: {
  /** Log prefix, e.g. 'write-tutorial'. */
  label: string;
  agent: AgentDefinition<any>;
  input: TIn;
  buildPrompt: (input: v.InferOutput<TIn>) => string;
}) {
  return defineWorkflow({
    agent: opts.agent,
    input: opts.input,
    output: outputSchema,
    async run({ harness, input, log }) {
      // The agent initializer reads REPO_PATH to set its sandbox cwd. Set it
      // (and the skip list) before the session initializes the agent.
      process.env.REPO_PATH = input.projectPath;
      process.env.SKIP_PHASES = JSON.stringify(input.skipPhases ?? []);

      const usage = trackTokenUsage();
      const components = trackComponentUsage();
      try {
        const session = await harness.session();
        // This closing prompt only collects the run's summary/insights — all the
        // real work (the written page) already happened. A transient network drop
        // here would otherwise discard a completed, expensive run, so retry it a
        // few times before giving up (see withTransientRetry).
        const { data } = await withTransientRetry(log, `${opts.label} summary`, () =>
          session.prompt(opts.buildPrompt(input), { result: outputSchema }),
        );
        log.info(`${opts.label} run insights: ${JSON.stringify(data.insights)}`);
        return data;
      } finally {
        const t = usage.stop();
        log.info(
          `${opts.label} token consumption: ${t.totalTokens} tokens ` +
            `(in ${t.input}, out ${t.output}, cacheRead ${t.cacheRead}, cacheWrite ${t.cacheWrite}) ` +
            `across ${t.turns} turns, cost $${t.cost.toFixed(4)}`,
          t,
        );
        log.info(`${opts.label} component usage: ${JSON.stringify(components.stop())}`);
      }
    },
  });
}
