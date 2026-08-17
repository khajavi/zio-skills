import { observe } from '@flue/runtime';
import { LOG_TAG } from './log.ts';

/** One line of a delegation prompt, short enough to sit in a timeline. */
function summarize(prompt: string): string {
  const line = prompt.split('\n').find((l) => l.trim().length > 0)?.trim() ?? '(empty prompt)';
  return line.length > 110 ? `${line.slice(0, 109)}…` : line;
}

/**
 * flue's built-in CLI printer only ever renders `tool ${event.toolName}`, never
 * the call's arguments, duration, or result — so bash commands, phase tools, and
 * role delegations are opaque in `flue run` output. Opt into full detail with
 * FLUE_VERBOSE_TOOLS=1.
 *
 * `log` events are the exception and print ALWAYS, verbose or not. `log.info(...)` does not write
 * anywhere by itself — it "emits a `log` event into the event stream" (reference/events.md:530), and
 * printing one needs an observer, which nothing here provided. So every phase's progress logging has
 * been invisible for this project's entire history: the review verdict, which checks a repeat narrowed
 * onto, what the write phase auto-fixed, and the warning that a delegated payload did not arrive. It is
 * also why the investigate-flowrite-log skill's advice to grep for `info ` lines never matched anything.
 * They are small, they are the application's own diagnostics, and a run that records no verdict cannot
 * be audited — so they are not gated behind a flag.
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
  const g = globalThis as { __flueVerboseInstalled?: boolean };
  if (g.__flueVerboseInstalled) return;
  g.__flueVerboseInstalled = true;

  const verbose = process.env.FLUE_VERBOSE_TOOLS === '1';
  const startedAt = new Map<string, number>();
  // The timeline's own clock, so the verbose `task` branch deleting its entry cannot blank a duration.
  const timelineStartedAt = new Map<string, number>();
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
    // Always, regardless of FLUE_VERBOSE_TOOLS — see the note above.
    if (event.type === 'log') {
      // A `log` event carries no id, so it cannot be deduped like the others. Tool logs are stamped
      // with `toolCallId`, which separates two calls that log the same sentence; the cost is that a
      // single call logging one message twice prints once. Nothing in this repo does that, and a
      // readable log is worth the trade.
      const from = (event.attributes?.toolCallId ?? event.attributes?.hook ?? '') as string;
      if (duplicate('log', `${event.level}|${from}|${event.message}`)) return;
      console.error(`[${event.level}] ${event.message}`);
      return;
    }
    // The phase timeline, also always. Phases are `task` delegations now, so no TypeScript runs when
    // one starts and nothing is left to call note(): deleting the phase tools took every phase's own
    // log line with it, and a converted run logged nothing at all until review. That emptied
    // `grep 'flowrite:' <log>`, which is the investigate-flowrite-log skill's primary view and the
    // reason f2ab0c6 introduced the tag. Rebuilt from the events instead, which see every delegation
    // whether or not a tool wraps it.
    //
    // Separate dedupe keys and a separate clock from the verbose lines below: sharing either would let
    // this branch consume the key, or delete the timestamp, and silence the verbose copy. No `return`
    // for the same reason — the verbose branches want these events too.
    if (event.type === 'task_start' && !duplicate('timeline_start', event.taskId)) {
      timelineStartedAt.set(event.taskId, Date.now());
      console.error(`[info] ${LOG_TAG}: → ${event.agent ?? '(unnamed)'}: ${summarize(event.prompt)}`);
    }
    if (event.type === 'task' && !duplicate('timeline_end', event.taskId)) {
      const start = timelineStartedAt.get(event.taskId);
      timelineStartedAt.delete(event.taskId);
      const took = start ? `${Math.round((Date.now() - start) / 1000)}s` : 'unknown time';
      const outcome = event.isError ? 'FAILED' : 'done';
      console.error(`[info] ${LOG_TAG}: ← ${event.agent ?? '(unnamed)'}: ${outcome} in ${took}`);
    }

    // Before the verbose gate: the dedupe set fills up in every mode, so it has to be cleared in
    // every mode too.
    if (event.type === 'agent_end') {
      // Only the outermost agent's end clears the run; a delegate's end does not.
      if (!event.taskId) seen.clear();
      return;
    }
    if (!verbose) return;

    switch (event.type) {
      case 'task_start': {
        if (duplicate(event.type, event.taskId)) return;
        startedAt.set(event.taskId, Date.now());
        console.error(`[verbose] delegate start ${event.agent ?? '(unnamed)'} prompt: ${event.prompt}`);
        return;
      }

      case 'task': {
        if (duplicate(event.type, event.taskId)) return;
        const start = startedAt.get(event.taskId);
        startedAt.delete(event.taskId);
        console.error(
          `[verbose] delegate end ${event.agent ?? '(unnamed)'} ` +
            `durationMs=${start ? Date.now() - start : undefined} isError=${event.isError} ` +
            `result: ${JSON.stringify(event.result)}`,
        );
        return;
      }

      case 'tool_start': {
        if (duplicate(event.type, event.toolCallId)) return;
        startedAt.set(event.toolCallId, Date.now());
        console.error(`[verbose] tool start ${event.toolName} args: ${JSON.stringify(event.args)}`);
        return;
      }

      case 'tool': {
        if (duplicate(event.type, event.toolCallId)) return;
        const start = startedAt.get(event.toolCallId);
        startedAt.delete(event.toolCallId);
        console.error(
          `[verbose] tool end ${event.toolName} durationMs=${start ? Date.now() - start : undefined} ` +
            `isError=${event.isError} result: ${JSON.stringify(event.result)}`,
        );
        return;
      }

      case 'turn': {
        if (duplicate(event.type, event.turnId)) return;
        // A delegated role's turns inherit the parent's harness, so `harness` alone
        // does not distinguish overhead from real work — `taskId` is what marks a
        // turn as belonging to a delegate, and is what cost attribution keys on.
        const where = [
          event.harness ? `harness=${event.harness}` : undefined,
          event.session ? `session=${event.session}` : undefined,
          event.taskId ? `taskId=${event.taskId}` : undefined,
        ]
          .filter(Boolean)
          .join(' ');
        console.error(
          `[verbose] turn ${where || 'root'} model=${event.request.requestedModel} ` +
            `effort=${event.request.reasoningLevel} tokens=${event.response.usage?.totalTokens ?? 0}`,
        );
        return;
      }
    }
  });
}
