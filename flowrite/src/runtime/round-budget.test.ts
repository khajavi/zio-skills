// The shared mechanism behind review_page's and fact_check_page's round budgets. Both phases' own
// test files exercise this indirectly through their full refusal-message flow; these tests pin the
// mechanism itself in isolation, so a regression here fails close to its cause.
import assert from 'node:assert/strict';
import test from 'node:test';

import { createOutcomeTracker, createRoundBudget } from './round-budget.ts';

test('rounds under budget are granted without touching confirming rounds', () => {
  const budget = createRoundBudget(3);
  assert.equal(budget.consume(2, false, false), 'granted');
  assert.equal(budget.consume(2, false, false), 'granted');
  assert.equal(budget.confirmingRounds, 0);
});

test('a round past budget with no findings is refused, not renewed', () => {
  const budget = createRoundBudget(3);
  budget.consume(1, false, false);
  assert.equal(budget.consume(1, false, false), 'refused');
  assert.equal(budget.confirmingRounds, 0);
  assert.equal(budget.budgetRefusals, 1);
});

test('a round past budget with findings earns exactly one confirming round', () => {
  const budget = createRoundBudget(3);
  budget.consume(1, false, false);
  assert.equal(budget.consume(1, true, false), 'granted');
  assert.equal(budget.confirmingRounds, 1);
  // A second call with the SAME (non-new) findings is not renewable.
  assert.equal(budget.consume(1, true, false), 'refused');
});

test('a confirming round renews only when the findings are new', () => {
  const budget = createRoundBudget(3);
  budget.consume(1, false, false);
  budget.consume(1, true, false); // confirming round #1
  assert.equal(budget.consume(1, true, true), 'granted'); // new findings -> renewed
  assert.equal(budget.confirmingRounds, 2);
});

test('renewal is capped at maxConfirmingRounds', () => {
  const budget = createRoundBudget(2);
  budget.consume(1, false, false);
  budget.consume(1, true, false); // confirming #1
  budget.consume(1, true, true); // confirming #2, at the cap
  assert.equal(budget.consume(1, true, true), 'refused');
  assert.equal(budget.confirmingRounds, 2);
});

test('reset clears every counter', () => {
  const budget = createRoundBudget(3);
  budget.consume(1, false, false);
  budget.consume(1, true, false);
  budget.consume(1, false, false); // refused
  budget.reset();
  assert.equal(budget.confirmingRounds, 0);
  assert.equal(budget.budgetRefusals, 0);
  assert.equal(budget.consume(1, false, false), 'granted');
});

// ---------------------------------------------------------------------------- outcome tracker

const keysOf = (outcome: string[] | null): string[] => outcome ?? [];

test('a fresh tracker has no findings and nothing to compare against', () => {
  const tracker = createOutcomeTracker(keysOf);
  assert.equal(tracker.hasFindings(), false);
  assert.equal(tracker.foundNewSinceLast(), false);
  assert.equal(tracker.last, null);
});

test('hasFindings reflects the last recorded outcome only', () => {
  const tracker = createOutcomeTracker(keysOf);
  tracker.record(['a']);
  assert.equal(tracker.hasFindings(), true);
  tracker.record([]);
  assert.equal(tracker.hasFindings(), false);
});

test('foundNewSinceLast is true only when the latest keys include one the previous round lacked', () => {
  const tracker = createOutcomeTracker(keysOf);
  tracker.record(['a']);
  tracker.record(['a']); // repeat, not new
  assert.equal(tracker.foundNewSinceLast(), false);
  tracker.record(['a', 'b']); // 'b' is new relative to ['a']
  assert.equal(tracker.foundNewSinceLast(), true);
});

test('reset forgets the last outcome', () => {
  const tracker = createOutcomeTracker(keysOf);
  tracker.record(['a']);
  tracker.reset();
  assert.equal(tracker.last, null);
  assert.equal(tracker.hasFindings(), false);
});

test('the very first record after a reset reads as "new" against an empty history', () => {
  // previousFindingKeys starts at null and is set to keysOf(null) = [] by this very call, so its own
  // keys compare as new against that empty baseline. Harmless in practice: RoundBudget.consume() only
  // asks foundNewSinceLast() once a round has already been refused by the plain budget check, and by
  // then `confirmingRounds === 0` already grants the first confirming round unconditionally — this
  // vacuous "new" never actually decides anything on its own. Pinned here so a future change to the
  // null-vs-empty handling doesn't silently start affecting that decision.
  const tracker = createOutcomeTracker(keysOf);
  tracker.record(['a']);
  assert.equal(tracker.foundNewSinceLast(), true);
});
