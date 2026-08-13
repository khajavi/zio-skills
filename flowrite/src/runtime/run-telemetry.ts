import type { ActivityReport, ComponentUsage, PhaseUsage } from './component-usage.ts';
import type { TokenUsageTotals } from './token-usage.ts';
import { maxReviewRounds } from './run-context.ts';

/**
 * The end-of-run report: what the run cost, what it did, and what looks wrong.
 *
 * Built from OBSERVED telemetry — the `observe()` event stream, via the trackers — and never from
 * anything the model says about itself. Its counterpart is self-report.ts, which is the model's own
 * account. Keeping the two apart is what lets a reader catch a run whose story does not match its
 * event stream; it is also why this report carries no review verdict (see FlagInput).
 *
 * Separate from the trackers on purpose. They observe and tally; this interprets. Interpretation is
 * where thresholds live, and thresholds are the part worth reviewing and testing — `computeFlags` is
 * a pure function for exactly that reason.
 *
 * It replaces a flat 17-row table in which 15 rows read `cost: 0`, for three unrelated reasons: a
 * phase's own spending was billed to `agent:default`, ordinary tools like `bash` are genuinely free,
 * and the plumbing tools always will be. One table cannot serve money, activity counts and plumbing
 * at once, so this splits them — and the activity section has no cost column at all, because
 * deleting the column is the fix rather than inventing numbers to fill it.
 */

/** One thing worth a human's attention, computed rather than eyeballed from the log. */
export interface RunFlag {
  /** Stable kebab-case identifier, so flags can be counted across runs. */
  code: string;
  /** The phase it concerns, when it concerns one. */
  phase?: string;
  detail: string;
}

export interface RunReport {
  totals: {
    cost: number;
    turns: number;
    tokens: number;
    /** cacheRead / tokens — how much of the run was re-sent context. Usually ~0.78. */
    cacheHitRate: number;
  };
  phases: (PhaseUsage & { share: number; calls: number; failedCalls: number; tokensPerOwnTurn: number })[];
  roles: { role: string; calls: number; cost: number }[];
  activity: ActivityReport;
  flags: RunFlag[];
}

/**
 * Deliberately carries no review verdict.
 *
 * It used to, from a module-level record of what the review actually returned. That record is gone,
 * so the only verdict left is the one the model reports to `report_run_result` — which lands in the
 * archive's `verdict.json` and is labelled there as self-reported. Piping it back into this report
 * would need a new module-state holder to carry it from the tool call to the end-of-run observer,
 * which is the holder that was just removed. So the report stays silent about pass/fail rather than
 * presenting a self-assessment in the place an independent one used to sit.
 */
export interface FlagInput {
  phases: PhaseUsage[];
  activity: ActivityReport;
  refusals: readonly { tool: string; parent: string }[];
  /** How many times `report_run_result` was called; >1 means a report was rejected and refiled. */
  reportCalls: number;
}

/**
 * Tunable, not settled: a phase whose own turns average this many times the median phase is flagged
 * as context-bloated. 3× was chosen because it flags the review phase (85k tokens/turn against
 * 8-21k elsewhere) and nothing else in the runs measured so far. Revisit with more data.
 */
const BLOAT_MULTIPLE = 3;

/** Tunable: one failed `edit` is a stale match, several is a loop. */
const TOOL_ERROR_THRESHOLD = 3;

/**
 * Review rounds allowed before the repeat is worth remarking on: the run's own budget.
 *
 * This used to be a flat 6, chosen when nothing bounded the review loop and this flag was its only
 * watcher. `maxReviewRounds()` now enforces a hard cap (default 1), which made a static 6 unreachable
 * — a flag that can never fire is worse than no flag, because it reads as coverage that is not there.
 *
 * Reading the same function the cap reads keeps the two in step: raise `MAX_REVIEW_ROUNDS` and the
 * threshold rises with it, so the flag still means "more rounds than this run was allowed" rather than
 * "more than some number I hardcoded". If it ever fires, the cap has been bypassed.
 */
const reviewRepeatLimit = () => maxReviewRounds();

const money = (n: number) => `$${n.toFixed(4)}`;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Derive the flags. Pure: same input, same flags, no runtime needed.
 *
 * A clean run must produce an empty array. A report that always complains gets ignored, so that is
 * the first property the tests pin.
 */
export function computeFlags(input: FlagInput): RunFlag[] {
  const { phases, activity, refusals, reportCalls } = input;
  const flags: RunFlag[] = [];
  // The synthetic bucket for turns outside any phase — it is not a phase and must not be judged
  // like one (it has no delegates, so it would always trip own-exceeds-delegate).
  const real = phases.filter((p) => !p.phase.startsWith('('));

  for (const [phase, calls] of Object.entries(activity.phaseCalls)) {
    // Review may repeat up to its budget; every other phase runs once. See reviewRepeatLimit.
    const isReview = phase.startsWith('review');
    const limit = isReview ? reviewRepeatLimit() : 1;
    if (calls > limit) {
      flags.push({
        code: 'phase-repeat',
        phase,
        detail: isReview
          ? `ran ${calls}× against a budget of ${limit} — the review cap did not hold`
          : `ran ${calls}× — repeated work, or a phase re-entered after failing`,
      });
    }
  }

  for (const [phase, failed] of Object.entries(activity.phaseFailures)) {
    const cost = real.find((p) => p.phase === phase)?.totalCost ?? 0;
    flags.push({
      code: 'phase-failed',
      phase,
      detail: `${failed} call(s) ended in error; the phase spent ${money(cost)} in total`,
    });
  }

  if (refusals.length > 0) {
    const where = refusals.map((r) => `${r.tool} inside ${r.parent}`).join('; ');
    flags.push({
      code: 'guard-refusal',
      detail: `${refusals.length} phase re-entry attempt(s) blocked: ${where}`,
    });
  }

  const giveUps = activity.tools['give_up'] ?? 0;
  if (giveUps > 0) {
    flags.push({ code: 'give-up', detail: `${giveUps} delegate(s) abandoned their task` });
  }

  if (activity.cdViolations > 0) {
    flags.push({
      code: 'cd-into-repo',
      detail:
        `${activity.cdViolations} bash command(s) cd'd into the repo, against the run directive — ` +
        `the shell already starts there`,
    });
  }

  // A run in which no review tool was called at all is still worth flagging — that is an activity
  // count, not a verdict, so it survives the verdict's removal.
  if (!Object.keys(activity.phaseCalls).some((phase) => phase.startsWith('review'))) {
    flags.push({ code: 'review-not-run', detail: 'no review phase ran for this page' });
  }

  for (const phase of real) {
    if (phase.delegateCost > 0 && phase.ownCost > phase.delegateCost) {
      flags.push({
        code: 'own-exceeds-delegate',
        phase: phase.phase,
        detail:
          `own ${money(phase.ownCost)} > delegate ${money(phase.delegateCost)} — the writer spent ` +
          `more coordinating than its roles spent working`,
      });
    }
  }

  // Needs at least three phases for a median to mean anything; a one- or two-phase run has no
  // baseline to be an outlier against.
  const perTurn = real.filter((p) => p.ownTurns > 0).map((p) => p.ownTokens / p.ownTurns);
  if (perTurn.length >= 3) {
    const mid = median(perTurn);
    for (const phase of real) {
      if (phase.ownTurns === 0) continue;
      const rate = phase.ownTokens / phase.ownTurns;
      if (rate > mid * BLOAT_MULTIPLE) {
        flags.push({
          code: 'context-bloat',
          phase: phase.phase,
          detail:
            `${Math.round(rate / 1000)}k tokens per own turn, ${(rate / mid).toFixed(1)}× the ` +
            `median phase — every turn re-sends everything accumulated before it`,
        });
      }
    }
  }

  if (reportCalls > 1) {
    flags.push({
      code: 'report-refiled',
      detail: `report_run_result called ${reportCalls}× — a report was rejected and refiled`,
    });
  }

  for (const [tool, errors] of Object.entries(activity.toolErrors)) {
    if (errors >= TOOL_ERROR_THRESHOLD) {
      flags.push({
        code: 'tool-errors',
        detail: `${tool} failed ${errors}× — path guessing, or an edit retried against a stale match`,
      });
    }
  }

  return flags;
}

/** Assemble the whole report from the trackers' snapshots. */
export function buildRunReport(input: {
  totals: TokenUsageTotals;
  components: ComponentUsage[];
  phases: PhaseUsage[];
  activity: ActivityReport;
  refusals: readonly { tool: string; parent: string }[];
}): RunReport {
  const { totals, components, phases, activity, refusals } = input;
  const runCost = phases.reduce((sum, p) => sum + p.totalCost, 0);

  return {
    totals: {
      cost: totals.cost,
      turns: totals.turns,
      tokens: totals.totalTokens,
      cacheHitRate: totals.totalTokens ? totals.cacheRead / totals.totalTokens : 0,
    },
    phases: phases.map((p) => ({
      ...p,
      share: runCost ? p.totalCost / runCost : 0,
      calls: activity.phaseCalls[p.phase] ?? 0,
      failedCalls: activity.phaseFailures[p.phase] ?? 0,
      tokensPerOwnTurn: p.ownTurns ? Math.round(p.ownTokens / p.ownTurns) : 0,
    })),
    roles: components
      .filter((c) => c.category === 'subagent')
      .map((c) => ({ role: c.name, calls: c.calls, cost: c.cost }))
      .sort((a, b) => b.cost - a.cost),
    activity,
    flags: computeFlags({
      phases,
      activity,
      refusals,
      reportCalls: activity.tools['report_run_result'] ?? 0,
    }),
  };
}
