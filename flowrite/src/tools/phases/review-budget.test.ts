// The review round budget.
//
// Worth testing because it is the one thing standing between a run and the loop measured on
// 2026-08-12: four review rounds, 1,082s, 40% of a 45-minute run, with per-round times that showed no
// sign of converging. A cap that silently failed to bind would look exactly like the old behaviour.
import assert from 'node:assert/strict';
import test from 'node:test';

import { __resetReviewRoundsForTests, consumeReviewRound } from './review-page.ts';
import { maxReviewRounds } from '../../runtime/run-context.ts';

/** Run `fn` with MAX_REVIEW_ROUNDS set to `value`, restoring the environment afterwards. */
function withBudget(value: string | undefined, fn: () => void): void {
  const previous = process.env.MAX_REVIEW_ROUNDS;
  if (value === undefined) delete process.env.MAX_REVIEW_ROUNDS;
  else process.env.MAX_REVIEW_ROUNDS = value;
  __resetReviewRoundsForTests();
  try {
    fn();
  } finally {
    if (previous === undefined) delete process.env.MAX_REVIEW_ROUNDS;
    else process.env.MAX_REVIEW_ROUNDS = previous;
    __resetReviewRoundsForTests();
  }
}

test('the default budget is one round', () => {
  withBudget(undefined, () => {
    assert.equal(maxReviewRounds(), 1);
    consumeReviewRound();
    assert.throws(() => consumeReviewRound(), /budget for this run is spent \(1 round, all used\)/);
  });
});

test('the refusal tells the model what to do instead', () => {
  // The thrown message is the only prompt the model gets at this point, so it has to carry the next
  // action — not just the fact of the refusal.
  withBudget(undefined, () => {
    consumeReviewRound();
    assert.throws(() => consumeReviewRound(), (error: Error) => {
      assert.match(error.message, /Do not call review again/);
      assert.match(error.message, /report_run_result/);
      assert.match(error.message, /reviewVerdict "failed"/);
      assert.match(error.message, /failingItems/);
      return true;
    });
  });
});

test('MAX_REVIEW_ROUNDS raises the budget, and it still binds', () => {
  withBudget('3', () => {
    assert.equal(maxReviewRounds(), 3);
    consumeReviewRound();
    consumeReviewRound();
    consumeReviewRound();
    assert.throws(() => consumeReviewRound(), /\(3 rounds, all used\)/);
  });
});

test('the budget is shared across every review tool, not per tool', () => {
  // A hierarchical module run reviews an index and then each subpage. Those are separate tools but one
  // run, and a per-tool budget would multiply the cost by the number of pages.
  withBudget(undefined, () => {
    consumeReviewRound();
    assert.throws(() => consumeReviewRound(), /budget for this run is spent/);
  });
});

test('a junk MAX_REVIEW_ROUNDS falls back to one rather than to unlimited', () => {
  // Failing open here would silently restore the unbounded loop, which is the failure this exists to
  // prevent. Zero and negative values are junk for the same reason: they would forbid reviewing at all.
  for (const junk of ['0', '-2', 'many', '2.5', '']) {
    withBudget(junk, () => {
      assert.equal(maxReviewRounds(), 1, `MAX_REVIEW_ROUNDS=${JSON.stringify(junk)} should fall back to 1`);
    });
  }
});
