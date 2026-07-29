import { defineWorkflow, type AgentDefinition, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';
import { trackTokenUsage } from './token-usage.ts';
import { trackComponentUsage } from './component-usage.ts';
import { insightsSchema } from './schemas.ts';
import { withTransientRetry } from './style-loop.ts';

/** Every write-* workflow returns the finished page path, a summary, and the run retrospective. */
const outputSchema = v.object({ path: v.string(), summary: v.string(), insights: insightsSchema });

/**
 * Shared route middleware for docs workflows. The docs-writer agent resolves its
 * sandbox cwd from REPO_PATH at agent-init time, which for `flue run` (and any
 * HTTP invocation) happens BEFORE the workflow's run() body executes — so setting
 * REPO_PATH inside run() is too late and the agent throws "REPO_PATH must be set".
 * This middleware runs earlier in the HTTP pipeline, ahead of the workflow handler
 * and its root-harness init, so it sets REPO_PATH from the invocation input first.
 * It reads a CLONED request so the handler's own body read is unaffected.
 */
export const docsWorkflowRoute: WorkflowRouteHandler = async (c, next) => {
  try {
    const body = (await c.req.raw.clone().json()) as { input?: { projectPath?: unknown }; projectPath?: unknown };
    const projectPath = body?.input?.projectPath ?? body?.projectPath;
    if (typeof projectPath === 'string' && projectPath.length > 0) {
      process.env.REPO_PATH = projectPath;
    }
  } catch {
    // No/invalid JSON body — let the workflow handler validate the input.
  }
  await next();
};

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
  TIn extends v.GenericSchema<{
    projectPath: string;
    skipPhases?: readonly string[] | undefined;
    userPrompt?: string | undefined;
  }>,
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
      // REPO_PATH is set early by docsWorkflowRoute for HTTP/`flue run` (before
      // agent init). Re-assert it here for non-HTTP callers (ambient invoke), and
      // set the skip list + author hint, which are read later at delegation time.
      process.env.REPO_PATH = input.projectPath;
      process.env.SKIP_PHASES = JSON.stringify(input.skipPhases ?? []);
      // Author hint: read by authorHint() at every subagent delegation site.
      // Always assign so a stale value from a previous dev-server run can't leak.
      process.env.USER_PROMPT = input.userPrompt ?? '';

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
