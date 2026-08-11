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

function report(label: string): void {
  const state = trackers();
  if (state.reported) return;
  state.reported = true;

  const t = state.tokens.stop();
  console.error(
    `${label} token consumption: ${t.totalTokens} tokens ` +
      `(in ${t.input}, out ${t.output}, cacheRead ${t.cacheRead}, cacheWrite ${t.cacheWrite}) ` +
      `across ${t.turns} turns, cost $${t.cost.toFixed(4)}`,
  );
  // Per phase before per component: "which phase cost the most" is the question actually asked of
  // these runs, and the component view cannot answer it — every phase's own harness turns collapse
  // into `agent:default`, which is why that line dominates while each phase reports zero tokens.
  console.error(`${label} phase usage: ${JSON.stringify(state.components.phases())}`);
  console.error(`${label} component usage: ${JSON.stringify(state.components.stop())}`);
}

// Subscribe at import time, before the first turn.
trackers();

/**
 * Declare the end-of-run usage summary. Root render only — useAgentFinish throws in
 * a delegate.
 *
 * Reported from two places, whichever comes first. `useAgentFinish` is the normal
 * path, but it does not run when a submission settles `failed` — a timeout or crash
 * would otherwise discard the cost of the run you most want the number for (a
 * module reference that blew the submission deadline reported nothing at all). The
 * process-exit hook is the backstop, and the `reported` guard keeps it to one
 * summary either way.
 */
export function useUsageReport(label: string): void {
  const g2 = globalThis as { __flowriteUsageExitHook?: boolean };
  if (!g2.__flowriteUsageExitHook) {
    g2.__flowriteUsageExitHook = true;
    process.once('exit', () => report(label));
  }
  useAgentFinish(() => report(label));
}
