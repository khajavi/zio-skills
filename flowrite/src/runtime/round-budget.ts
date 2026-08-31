/**
 * Shared round-budget bookkeeping for a gated phase that may need to look at the same page more than
 * once: `review_page` and `fact_check_page`.
 *
 * Both phases need the identical mechanism — a hard round budget, a confirming round granted only
 * when the last round reported findings, renewed only when those findings are NEW relative to the
 * round before, and capped so an unrepairable page still terminates — and until now each one
 * maintained its own copy of the counters and the renewal decision. The message a refusal throws
 * differs per phase (different nouns, different next-step instructions) and each phase's tests assert
 * on that exact wording, so message-building stays local to each file; only the bookkeeping moves here.
 */

/** How many rounds have run, and whether a confirming round is still available. */
export interface RoundBudget {
  /** Spend one round against `budget`, or decide a refusal. Never throws — the caller does that. */
  consume(budget: number, hasFindings: boolean, foundNew: boolean): 'granted' | 'refused';
  /** Confirming rounds granted so far, for the refusal message ("plus N confirming rounds"). */
  readonly confirmingRounds: number;
  /** Rounds refused so far, for the run report. */
  readonly budgetRefusals: number;
  /** Tests only — module-level counters have no other seam. */
  reset(): void;
}

export function createRoundBudget(maxConfirmingRounds: number): RoundBudget {
  let roundsUsed = 0;
  let confirmingRounds = 0;
  let budgetRefusals = 0;

  return {
    consume(budget, hasFindings, foundNew) {
      if (roundsUsed < budget) {
        roundsUsed++;
        return 'granted';
      }

      // A grant is renewed only when the round that spent the last one reported findings the round
      // before it never mentioned. That round confirmed nothing — it found more work — so the run
      // earns another rather than freezing its verdict on findings it then repaired.
      const renewable = confirmingRounds === 0 || foundNew;
      if (hasFindings && renewable && confirmingRounds < maxConfirmingRounds) {
        confirmingRounds++;
        roundsUsed++;
        return 'granted';
      }

      budgetRefusals++;
      return 'refused';
    },
    get confirmingRounds() {
      return confirmingRounds;
    },
    get budgetRefusals() {
      return budgetRefusals;
    },
    reset() {
      roundsUsed = 0;
      confirmingRounds = 0;
      budgetRefusals = 0;
    },
  };
}

/**
 * Tracks the last recorded outcome of a round and whether its findings are new relative to the one
 * before it — the piece `RoundBudget.consume` needs but cannot compute itself, since what counts as a
 * "finding" (failing checklist items, source drifts, an incomplete check) differs per phase.
 */
export interface OutcomeTracker<TOutcome> {
  /** Record a new outcome, remembering the previous one's finding keys for the next renewal check. */
  record(outcome: TOutcome | null): void;
  readonly last: TOutcome | null;
  hasFindings(): boolean;
  foundNewSinceLast(): boolean;
  /** Tests only — module-level state has no other seam. */
  reset(): void;
}

export function createOutcomeTracker<TOutcome>(
  findingKeysOf: (outcome: TOutcome | null) => string[],
): OutcomeTracker<TOutcome> {
  let lastOutcome: TOutcome | null = null;
  let previousFindingKeys: string[] | null = null;

  return {
    record(outcome) {
      previousFindingKeys = findingKeysOf(lastOutcome);
      lastOutcome = outcome;
    },
    get last() {
      return lastOutcome;
    },
    hasFindings() {
      return findingKeysOf(lastOutcome).length > 0;
    },
    foundNewSinceLast() {
      const keys = findingKeysOf(lastOutcome);
      const previous = previousFindingKeys;
      return previous !== null && keys.some((key) => !previous.includes(key));
    },
    reset() {
      lastOutcome = null;
      previousFindingKeys = null;
    },
  };
}
