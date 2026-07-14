import { observe } from '@flue/runtime';

/**
 * flue's built-in CLI printer only ever renders `tool ${event.toolName}`, never
 * the call's arguments, duration, or result — so bash commands, action calls,
 * and subagent delegations (the "task" tool) are opaque in `flue run` output.
 * Opt into full detail with FLUE_VERBOSE_TOOLS=1. Subagent/action/tool calls
 * are all tool_start/tool events under the hood — one observer covers all three.
 *
 * No-op unless FLUE_VERBOSE_TOOLS=1. Call once at workflow module load.
 */
export function installVerboseObserver(): void {
  if (process.env.FLUE_VERBOSE_TOOLS !== '1') return;

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
