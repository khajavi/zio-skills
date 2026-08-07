import { observe } from '@flue/runtime';

/**
 * flue's built-in CLI printer only ever renders `tool ${event.toolName}`, never
 * the call's arguments, duration, or result — so bash commands, phase tools, and
 * role delegations are opaque in `flue run` output. Opt into full detail with
 * FLUE_VERBOSE_TOOLS=1.
 *
 * No-op unless FLUE_VERBOSE_TOOLS=1.
 *
 * Delegation is its own event pair in Flue 2 (`task_start`/`task`, carrying the
 * delegate in `event.agent`), so this no longer infers it from a tool named
 * "task". Turns are logged too: they are how the extra harness hop shows up, and
 * `requestedModel`/`reasoningLevel` are what prove a role's tier override applied.
 *
 * Deduping: flue re-publishes each event up the session tree (a role's tool event
 * is published in its own context, then forwarded and re-published at every parent
 * context so parent observers see child activity). Each re-publish invokes the
 * global observe() subscribers again, so one call arrives once per level of
 * nesting. Forwarded copies keep their original id, so log each `type:id` once and
 * drop the copies. `agent_end` at top level clears the set so a long-lived process
 * doesn't accumulate keys across runs.
 *
 * The globalThis guard is separate hygiene: `observe()` has no idempotency, so the
 * guard keeps it to one subscriber per process.
 */
export function installVerboseObserver(): void {
  if (process.env.FLUE_VERBOSE_TOOLS !== '1') return;

  const g = globalThis as { __flueVerboseInstalled?: boolean };
  if (g.__flueVerboseInstalled) return;
  g.__flueVerboseInstalled = true;

  const startedAt = new Map<string, number>();
  const seen = new Set<string>(); // `${type}:${id}` already logged this run

  /** True when this is a re-published copy forwarded from a child context. */
  const duplicate = (type: string, id: string | undefined): boolean => {
    if (!id) return false;
    const key = `${type}:${id}`;
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  };

  observe((event) => {
    switch (event.type) {
      case 'agent_end': {
        // Only the outermost agent's end clears the run; a delegate's end does not.
        if (!event.taskId) seen.clear();
        return;
      }

      case 'task_start': {
        if (duplicate(event.type, event.taskId)) return;
        startedAt.set(event.taskId, Date.now());
        console.log(`[verbose] delegate start ${event.agent ?? '(unnamed)'} prompt: ${event.prompt}`);
        return;
      }

      case 'task': {
        if (duplicate(event.type, event.taskId)) return;
        const start = startedAt.get(event.taskId);
        startedAt.delete(event.taskId);
        console.log(
          `[verbose] delegate end ${event.agent ?? '(unnamed)'} ` +
            `durationMs=${start ? Date.now() - start : undefined} isError=${event.isError} ` +
            `result: ${JSON.stringify(event.result)}`,
        );
        return;
      }

      case 'tool_start': {
        if (duplicate(event.type, event.toolCallId)) return;
        startedAt.set(event.toolCallId, Date.now());
        console.log(`[verbose] tool start ${event.toolName} args: ${JSON.stringify(event.args)}`);
        return;
      }

      case 'tool': {
        if (duplicate(event.type, event.toolCallId)) return;
        const start = startedAt.get(event.toolCallId);
        startedAt.delete(event.toolCallId);
        console.log(
          `[verbose] tool end ${event.toolName} durationMs=${start ? Date.now() - start : undefined} ` +
            `isError=${event.isError} result: ${JSON.stringify(event.result)}`,
        );
        return;
      }

      case 'turn': {
        if (duplicate(event.type, event.turnId)) return;
        // `harness` names the phase tool whose scratch conversation ran this turn.
        const where = event.harness ? `harness=${event.harness}` : `session=${event.session ?? 'root'}`;
        console.log(
          `[verbose] turn ${where} model=${event.request.requestedModel} ` +
            `effort=${event.request.reasoningLevel} tokens=${event.response.usage?.totalTokens ?? 0}`,
        );
        return;
      }
    }
  });
}
