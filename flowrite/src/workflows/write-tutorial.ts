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
  }),
  output: v.object({ path: v.string(), summary: v.string() }),
  async run({ harness, input, log }) {
    // The agent initializer reads REPO_PATH to set its sandbox cwd. Set it
    // from projectPath before the session initializes the agent.
    process.env.REPO_PATH = input.projectPath;

    const usage = trackTokenUsage();
    const components = trackComponentUsage();
    try {
      const session = await harness.session();
      const { data } = await session.prompt(
        `Write a complete, compile-verified tutorial for: ${input.topic}. ` +
          `The library checkout (repo root) is at ${input.projectPath}. ` +
          `Run the full flow (research → design → write → examples → mdoc verify → integrate → review). ` +
          `Report the final tutorial file path and a one-line summary.`,
        {
          result: v.object({ path: v.string(), summary: v.string() }),
        },
      );
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
