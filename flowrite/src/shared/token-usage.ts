import { observe, type FlueEvent } from '@flue/runtime';

/** Accumulated token and cost totals across a tracked span of runtime activity. */
export interface TokenUsageTotals {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: number;
  turns: number;
  /** All totals are numeric; enables passing straight to `log.info(...)`. */
  [metric: string]: number;
}

/** A live token-usage tracker. Read `totals` any time; call `stop()` to unsubscribe. */
export interface TokenUsageTracker {
  readonly totals: Readonly<TokenUsageTotals>;
  stop(): TokenUsageTotals;
}

/**
 * Subscribe to runtime activity and sum token/cost across leaf `turn` events.
 *
 * Per the observability guidance, this sums model-turn leaves — never the
 * `operation` or `compaction` roll-ups, whose values overlap. Because it counts
 * every turn in the process, it captures nested subagent and action turns, so a
 * single tracker wrapping a workflow run yields the whole-workflow total.
 *
 * `observe()` is process-global; scope a tracker to one run by starting it right
 * before the run and calling `stop()` in a `finally`.
 */
export function trackTokenUsage(): TokenUsageTracker {
  const totals: TokenUsageTotals = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: 0,
    turns: 0,
  };

  const unsubscribe = observe((event: FlueEvent) => {
    if (event.type !== 'turn') return;
    const u = event.response.usage;
    if (!u) return;
    totals.input += u.input;
    totals.output += u.output;
    totals.cacheRead += u.cacheRead;
    totals.cacheWrite += u.cacheWrite;
    totals.totalTokens += u.totalTokens;
    totals.cost += u.cost.total;
    totals.turns += 1;
  });

  let stopped = false;
  return {
    totals,
    stop() {
      if (!stopped) {
        unsubscribe();
        stopped = true;
      }
      return totals;
    },
  };
}
