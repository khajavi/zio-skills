import { useAgentFinish } from '@flue/runtime';
import { trackTokenUsage, type TokenUsageTracker } from './token-usage.ts';
import { trackComponentUsage, type ComponentUsageTracker } from './component-usage.ts';

/**
 * Per-run token, cost, and per-component usage reporting.
 *
 * This lived in the deleted workflow wrapper's `finally` block, which was the only
 * caller of the two trackers. Without it a run produces no cost figures at all,
 * which breaks both the "observable by construction" property and any comparison
 * against an archived run.
 *
 * Tracking starts at module load rather than in a hook: `observe()` is
 * process-global, one process serves one run, and the trackers must be subscribed
 * before the first turn — earlier than any render. Reporting hangs off
 * `useAgentFinish`, whose callbacks run at least once, so a guard keeps the summary
 * to a single emission.
 *
 * Logs go to stderr: `flue run` reserves stdout for the reply, and `--json` expects
 * it to parse.
 */
const g = globalThis as {
  __flowriteUsage?: { tokens: TokenUsageTracker; components: ComponentUsageTracker; reported: boolean };
};

function trackers() {
  g.__flowriteUsage ??= { tokens: trackTokenUsage(), components: trackComponentUsage(), reported: false };
  return g.__flowriteUsage;
}

// Subscribe at import time, before the first turn.
trackers();

/** Declare the end-of-run usage summary. Root render only — useAgentFinish throws in a delegate. */
export function useUsageReport(label: string): void {
  useAgentFinish(() => {
    const state = trackers();
    if (state.reported) return;
    state.reported = true;

    const t = state.tokens.stop();
    console.error(
      `${label} token consumption: ${t.totalTokens} tokens ` +
        `(in ${t.input}, out ${t.output}, cacheRead ${t.cacheRead}, cacheWrite ${t.cacheWrite}) ` +
        `across ${t.turns} turns, cost $${t.cost.toFixed(4)}`,
    );
    console.error(`${label} component usage: ${JSON.stringify(state.components.stop())}`);
  });
}
