import { observe } from '@flue/runtime';

/**
 * flue's built-in CLI printer only ever renders `tool ${event.toolName}`, never
 * the call's arguments, duration, or result — so bash commands, action calls,
 * and subagent delegations (the "task" tool) are opaque in `flue run` output.
 * Opt into full detail with FLUE_VERBOSE_TOOLS=1. Subagent/action/tool calls
 * are all tool_start/tool events under the hood — one observer covers all three.
 *
 * No-op unless FLUE_VERBOSE_TOOLS=1. Safe to call from every workflow module:
 * `observe()` is a global, process-wide subscription with no idempotency, and
 * flue imports every workflow entrypoint at startup (often evaluating each more
 * than once). Without a guard, each call adds another subscriber and every event
 * prints once per subscriber (the 4× duplicate lines). The flag lives on
 * globalThis so it survives repeated module evaluation — a module-level `let`
 * would reset per instance and not dedup across them.
 */
export function installVerboseObserver(): void {
  if (process.env.FLUE_VERBOSE_TOOLS !== '1') return;

  const g = globalThis as { __flueVerboseInstalled?: boolean };
  if (g.__flueVerboseInstalled) return;
  g.__flueVerboseInstalled = true;

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
