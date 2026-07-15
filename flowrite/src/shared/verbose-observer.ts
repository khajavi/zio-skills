import { observe } from '@flue/runtime';

/**
 * flue's built-in CLI printer only ever renders `tool ${event.toolName}`, never
 * the call's arguments, duration, or result — so bash commands, action calls,
 * and subagent delegations (the "task" tool) are opaque in `flue run` output.
 * Opt into full detail with FLUE_VERBOSE_TOOLS=1. Subagent/action/tool calls
 * are all tool_start/tool events under the hood — one observer covers all three.
 *
 * No-op unless FLUE_VERBOSE_TOOLS=1.
 *
 * Deduping: flue re-publishes each event up the session tree (a subagent's tool
 * event is published in its own context, then forwarded and re-published at every
 * parent context so parent observers see child activity — see
 * createSubmissionEventCallback in the runtime). Each re-publish invokes the
 * global observe() subscribers again, so one tool call arrives once per level of
 * session nesting (the 3-4x duplicate lines, varying by depth). Forwarded copies
 * keep the original `toolCallId`, so we log each `type:toolCallId` once and drop
 * the re-published copies. `run_end` clears the set so a long-lived process
 * (dev server) doesn't accumulate keys across runs.
 *
 * The globalThis guard is separate hygiene: `observe()` has no idempotency and
 * every workflow module calls this at load, so the guard keeps it to one
 * subscriber per process.
 */
export function installVerboseObserver(): void {
  if (process.env.FLUE_VERBOSE_TOOLS !== '1') return;

  const g = globalThis as { __flueVerboseInstalled?: boolean };
  if (g.__flueVerboseInstalled) return;
  g.__flueVerboseInstalled = true;

  const startedAt = new Map<string, number>();
  const seen = new Set<string>(); // `${type}:${toolCallId}` already logged this run

  observe((event) => {
    if (event.type === 'run_end') {
      seen.clear();
      return;
    }

    if (event.type === 'tool_start' || event.type === 'tool') {
      const key = `${event.type}:${event.toolCallId}`;
      if (seen.has(key)) return; // re-published copy forwarded from a child context
      seen.add(key);
    }

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
