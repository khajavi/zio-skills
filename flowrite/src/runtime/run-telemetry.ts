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

/**
 * Phases exempt from the repeat check because they legitimately run per documented type.
 *
 * Empty now: the per-type phases were `research_data_type` and `write_data_type_reference`, and both are
 * deleted — a hierarchical module reference reaches those roles with `task` instead. `review_page` is the
 * only phase tool left and it has its own budget check, so nothing needs exempting. Kept as a named
 * constant rather than inlined, because a fourth document kind adding a per-type phase would want it.
 */
const PER_TYPE_PHASES: readonly string[] = [];

/**
 * Every drafted page should have exactly one research delegation behind it.
 *
 * The signal the old repeat-count check was standing in front of: on `write-module-ref-turn5` four
 * research calls with one failure produced three real API surfaces against four drafted pages, so a
 * subpage was written with no research of its own — invisible to a rule that only asked whether a phase
 * ran more than once.
 *
 * Both directions are worth a flag, and they mean opposite things: fewer research results than pages is
 * a grounding problem, more is a delegation paid for and thrown away.
 */
function perTypePairing(activity: ActivityReport): RunFlag[] {
  // Counted per ROLE, not per phase tool. The phase tools this used to read are gone, and `task` is one
  // tool name whatever role it reaches, so the delegation counts are the only place the stages are still
  // distinguishable.
  //
  // Weaker than the version it replaces, in a way worth knowing before trusting a clean result:
  // `task_start` counts attempts, so a researcher that ran and gave up still counts as a delegation.
  // That is exactly turn5's shape — 4 research calls, 1 failed, 4 pages drafted — and this arithmetic
  // now reads it as balanced. It still catches the grosser fault, a page drafted with no research
  // delegation behind it at all, and it reports failed delegations alongside so the reader can see when
  // the balance is hollow.
  const researched = activity.delegations['researcher'] ?? 0;
  // Pages, not drafter delegations. A module run batched both subpages into ONE delegation, and this
  // flag then announced "3 research delegation(s) but only 2 page(s) drafted — research paid for and
  // never used" while all 3 pages sat on disk. Counting writes to docs/ keeps the flag measuring the
  // thing it names; how the drafting was organized is `delegations['drafter']`, reported separately.
  const drafted = activity.pagesWritten;
  const failedDelegations = activity.toolErrors['task'] ?? 0;

  if (researched === drafted) {
    return failedDelegations === 0
      ? []
      : [
          {
            code: 'delegation-failures',
            phase: 'task',
            detail:
              `${researched} research and ${drafted} draft delegation(s), but ${failedDelegations} ` +
              `delegation(s) failed — a balanced count can still hide a page written from a research ` +
              `call that returned nothing`,
          },
        ];
  }

  return [
    {
      code: 'research-draft-mismatch',
      phase: 'drafter',
      detail:
        researched < drafted
          ? `${drafted} page(s) drafted from ${researched} research delegation(s) — a page was ` +
            `written without its own API surface`
          : `${researched} research delegation(s) but only ${drafted} page(s) drafted — ` +
            `research paid for and never used`,
    },
  ];
}

const money = (n: number) => `$${n.toFixed(4)}`;


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
    // Review may repeat up to its budget; the per-type phases have their own check below; every
    // other phase runs once. See reviewRepeatLimit and PER_TYPE_PHASES.
    const isReview = phase.startsWith('review');
    if (!isReview && PER_TYPE_PHASES.includes(phase)) continue;
    const limit = isReview ? reviewRepeatLimit() : 1;
    // A refused call is not a run. `phaseCalls` counts `tool_start`, so the round the budget REFUSED
    // is in there — which made this flag fire on every run where the cap worked, reporting "the review
    // cap did not hold" as the direct result of the cap holding. Observed in turns 1, 2 and 3 of the
    // tinytally data-type archive, all three of them correct runs.
    const ran = calls - (activity.phaseFailures[phase] ?? 0);
    if (ran > limit) {
      flags.push({
        code: 'phase-repeat',
        phase,
        detail: isReview
          ? `ran ${ran}× against a budget of ${limit} — the review cap did not hold`
          : `ran ${ran}× — repeated work, or a phase re-entered after failing`,
      });
    }
  }

  flags.push(...perTypePairing(activity));

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

  // The context-bloat flag is gone, and it is worth saying why rather than leaving it dormant.
  //
  // It compared each phase's tokens-per-own-turn against the median across phases, needing at least
  // three to have a baseline at all. Own turns belong to a scratch conversation, and there is one
  // phase tool left — so the population is `review_page` plus `(orchestration)`, the guard never
  // clears, and the flag could not fire again. A check that cannot fire reads as coverage that is not
  // there, which is the same trap `reviewRepeatLimit`'s comment describes.
  //
  // The phenomenon it watched is real and has not gone away: the root conversation grows, and it was
  // 43% of the last measured run. But one row cannot be an outlier against itself, and inventing a
  // fixed tokens-per-turn threshold would be a number with nothing behind it. `tokensPerOwnTurn` is
  // in the table for a reader to judge; when there is enough data to justify a threshold, it can come
  // back as a rule about the orchestration row specifically.

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
