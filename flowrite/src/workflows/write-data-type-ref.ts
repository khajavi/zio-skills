import { defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';
import dataTypeRefWriter from '../agents/data-type-ref-writer.ts';
import { trackTokenUsage } from '../shared/token-usage.ts';
import { trackComponentUsage } from '../shared/component-usage.ts';
import { installVerboseObserver } from '../shared/verbose-observer.ts';

/**
 * Finite wrapper around the data-type-ref-writer agent for CI, scheduled, or
 * batch runs. Takes the library checkout (`projectPath`) and the `typeName`.
 * The agent resolves its sandbox cwd from REPO_PATH, so the run sets that from
 * projectPath before opening a session. Mirrors write-tutorial.ts.
 */
export const route: WorkflowRouteHandler = async (_c, next) => next();

const insightsSchema = v.array(
  v.object({
    phase: v.picklist(['research', 'design', 'write', 'mdoc', 'examples', 'integrate', 'review']),
    obstacle: v.pipe(v.string(), v.description('What actually went wrong or slowed you down this run')),
    resolution: v.pipe(v.string(), v.description('How you got past it')),
    suggestedFix: v.nullable(
      v.pipe(
        v.string(),
        v.description('A concrete instruction/tool/schema change that would prevent this next time, or null'),
      ),
    ),
  }),
);

// FLUE_VERBOSE_TOOLS=1 opts into full tool/subagent call detail.
installVerboseObserver();

export default defineWorkflow({
  agent: dataTypeRefWriter,
  input: v.object({
    projectPath: v.pipe(v.string(), v.description('Absolute path to the ZIO library checkout to document')),
    typeName: v.pipe(v.string(), v.description('The data type to document, e.g. "Chunk"')),
    skipPhases: v.optional(
      v.pipe(
        v.array(v.picklist(['research', 'design', 'write', 'write-examples', 'integrate', 'review'])),
        v.description(
          'Phases to skip (only code-gated phases; mdoc verify is agent-driven and always runs). ' +
            'Skipping a head-phase prefix resumes a run whose artifacts already exist, ' +
            'e.g. ["research", "design", "write"] runs only the examples/integrate/review tail.',
        ),
      ),
    ),
  }),
  output: v.object({ path: v.string(), summary: v.string(), insights: insightsSchema }),
  async run({ harness, input, log }) {
    process.env.REPO_PATH = input.projectPath;
    process.env.SKIP_PHASES = JSON.stringify(input.skipPhases ?? []);

    const usage = trackTokenUsage();
    const components = trackComponentUsage();
    try {
      const session = await harness.session();
      const { data } = await session.prompt(
        `Write a complete, compile-verified data type reference page for: ${input.typeName}. ` +
          `The library checkout (repo root) is at ${input.projectPath}. ` +
          `Run the full flow (research → design → write → examples → mdoc verify → integrate → ` +
          `review; review covers method coverage + writing style + the checklist). ` +
          `Report the final page path, a one-line summary, and a run retrospective: the real obstacles ` +
          `you hit this run and how you resolved them (empty if it went smoothly — never invent friction).`,
        {
          result: v.object({ path: v.string(), summary: v.string(), insights: insightsSchema }),
        },
      );
      log.info(`write-data-type-ref run insights: ${JSON.stringify(data.insights)}`);
      return data;
    } finally {
      const t = usage.stop();
      log.info(
        `write-data-type-ref token consumption: ${t.totalTokens} tokens ` +
          `(in ${t.input}, out ${t.output}, cacheRead ${t.cacheRead}, cacheWrite ${t.cacheWrite}) ` +
          `across ${t.turns} turns, cost $${t.cost.toFixed(4)}`,
        t,
      );
      log.info(`write-data-type-ref component usage: ${JSON.stringify(components.stop())}`);
    }
  },
});
