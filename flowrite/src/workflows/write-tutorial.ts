import { defineWorkflow, observe, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';
import tutorialWriter from '../agents/tutorial-writer.ts';
import { trackTokenUsage } from '../shared/token-usage.ts';
import { trackComponentUsage } from '../shared/component-usage.ts';

/**
 * Finite wrapper around the tutorial-writer agent for CI, scheduled, or batch
 * runs. Takes the library checkout (`projectPath`) and the `topic`. The agent
 * resolves its sandbox cwd from REPO_PATH, so the run sets that from
 * projectPath before opening a session.
 */
export const route: WorkflowRouteHandler = async (_c, next) => next();

// A self-authored run retrospective: the obstacles the agent actually hit and
// how it got past them, so recurring friction can be mined across runs (each
// turn's insights.json in the archive) to drive instruction/tool improvements.
const insightsSchema = v.array(
  v.object({
    phase: v.picklist(['research', 'design', 'write', 'examples', 'mdoc', 'integrate', 'review']),
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

// flue's built-in CLI printer only ever renders `tool ${event.toolName}`, never
// the call's arguments, duration, or result — so bash commands, action calls,
// and subagent delegations (the "task" tool) are opaque in `flue run` output.
// Opt into full detail with FLUE_VERBOSE_TOOLS=1. Subagent/action/tool calls
// are all tool_start/tool events under the hood — one observer covers all three.
if (process.env.FLUE_VERBOSE_TOOLS === '1') {
  const startedAt = new Map<string, number>();

  observe((event) => {
    if (event.type === 'tool_start') {
      startedAt.set(event.toolCallId, Date.now());
      const kind = event.toolName === 'task' ? 'subagent-task' : 'tool';
      console.log(`[verbose] ${kind} start ${event.toolName} args: ${JSON.stringify(event.args)}`);
      return;
    }

    if (event.type === 'tool') {
      const start = startedAt.get(event.toolCallId);
      startedAt.delete(event.toolCallId);
      const durationMs = start ? Date.now() - start : undefined;
      const kind = event.toolName === 'task' ? 'subagent-task' : 'tool';
      console.log(
        `[verbose] ${kind} end ${event.toolName} durationMs=${durationMs} isError=${event.isError} ` +
          `result: ${JSON.stringify(event.result)}`,
      );
    }
  });
}

export default defineWorkflow({
  agent: tutorialWriter,
  input: v.object({
    projectPath: v.pipe(
      v.string(),
      v.description('Absolute path to the ZIO library checkout to document'),
    ),
    topic: v.pipe(v.string(), v.description('Tutorial title or topic description')),
    skipPhases: v.optional(
      v.pipe(
        v.array(v.picklist(['research', 'design', 'write', 'write-examples', 'integrate', 'review'])),
        v.description(
          'Phases to skip. Skipping a head-phase prefix resumes a run whose artifacts already exist, ' +
            'e.g. ["research", "design", "write", "write-examples"] runs only integrate + review.',
        ),
      ),
    ),
  }),
  output: v.object({ path: v.string(), summary: v.string(), insights: insightsSchema }),
  async run({ harness, input, log }) {
    // The agent initializer reads REPO_PATH to set its sandbox cwd. Set it
    // from projectPath before the session initializes the agent.
    process.env.REPO_PATH = input.projectPath;
    process.env.SKIP_PHASES = JSON.stringify(input.skipPhases ?? []);

    const usage = trackTokenUsage();
    const components = trackComponentUsage();
    try {
      const session = await harness.session();
      const { data } = await session.prompt(
        `Write a complete, compile-verified tutorial for: ${input.topic}. ` +
          `The library checkout (repo root) is at ${input.projectPath}. ` +
          `Run the full flow (research → design → write → examples → mdoc verify → integrate → review). ` +
          `Report the final tutorial file path, a one-line summary, and a run retrospective: ` +
          `the real obstacles you hit this run and how you resolved them (empty if it went smoothly — ` +
          `never invent friction).`,
        {
          result: v.object({ path: v.string(), summary: v.string(), insights: insightsSchema }),
        },
      );
      log.info(`write-tutorial run insights: ${JSON.stringify(data.insights)}`);
      return data;
    } finally {
      const t = usage.stop();
      log.info(
        `write-tutorial token consumption: ${t.totalTokens} tokens ` +
          `(in ${t.input}, out ${t.output}, cacheRead ${t.cacheRead}, cacheWrite ${t.cacheWrite}) ` +
          `across ${t.turns} turns, cost $${t.cost.toFixed(4)}`,
        t,
      );
      log.info(`write-tutorial component usage: ${JSON.stringify(components.stop())}`);
    }
  },
});
