// The review round budget.
//
// Worth testing because it is the one thing standing between a run and the loop measured on
// 2026-08-12: four review rounds, 1,082s, 40% of a 45-minute run, with per-round times that showed no
// sign of converging. A cap that silently failed to bind would look exactly like the old behaviour.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  __resetLastReviewForTests,
  __resetReviewRoundsForTests,
  __setLastReviewForTests,
  consumeReviewRound,
  recordedVerdict,
} from './review-page.ts';
import { docKind, maxReviewRounds, setRunContext } from '../../runtime/run-context.ts';

/** Run `fn` with MAX_REVIEW_ROUNDS set to `value`, restoring the environment afterwards. */
function withBudget(value: string | undefined, fn: () => void): void {
  const previous = process.env.MAX_REVIEW_ROUNDS;
  if (value === undefined) delete process.env.MAX_REVIEW_ROUNDS;
  else process.env.MAX_REVIEW_ROUNDS = value;
  __resetReviewRoundsForTests();
  // Also clear the recorded review: consumeReviewRound reads it to decide whether a confirming round
  // is owed, so a failing outcome left by an earlier test would grant one and make a budget assertion
  // pass for the wrong reason. Order-independence here is the point.
  __resetLastReviewForTests();
  try {
    fn();
  } finally {
    if (previous === undefined) delete process.env.MAX_REVIEW_ROUNDS;
    else process.env.MAX_REVIEW_ROUNDS = previous;
    __resetReviewRoundsForTests();
    __resetLastReviewForTests();
  }
}

/** A recorded review with `failing` items failing and one passing. */
function reviewed(failing: string[]): void {
  __setLastReviewForTests({
    state: 'reviewed',
    items: [
      { item: 'something that passed', pass: true, issue: '' },
      ...failing.map((item) => ({ item, pass: false, issue: 'broken' })),
    ],
  });
}

test('a failing review earns one confirming round, so fixes can be recorded as verified', () => {
  // #67: recordedVerdict() returns the LAST outcome, and a refused call records none — so under a hard
  // budget of one, a run that repaired every finding still filed the pre-fix verdict.
  // write-module-ref-turn4 fixed 5 of 6 items, filed all 6, then claimed "production-ready" in prose.
  withBudget(undefined, () => {
    consumeReviewRound();
    reviewed(['Layout matches auto-rule']);
    consumeReviewRound(); // the confirming round, granted because the last review failed
    __setLastReviewForTests({ state: 'reviewed', items: [{ item: 'all good', pass: true, issue: '' }] });
    assert.deepEqual(recordedVerdict(), { verdict: 'passed', failingItems: [] });
  });
});

test('a round that only repeats the previous findings ends the run, so a broken page cannot loop', () => {
  withBudget(undefined, () => {
    consumeReviewRound();
    reviewed(['still broken']);
    consumeReviewRound();
    // Second round found the same item. It confirmed what it could, so no further round is owed: the
    // run ends reporting failed rather than paying for a third opinion on an unchanged page.
    reviewed(['still broken']);
    assert.throws(() => consumeReviewRound(), /plus 1 confirming round, all used/);
    assert.throws(() => consumeReviewRound(), /repeated items the one before it already reported/);
    assert.deepEqual(recordedVerdict(), { verdict: 'failed', failingItems: ['still broken'] });
  });
});

test('a confirming round that raises NEW items earns another, so the verdict can outlive the fixes', () => {
  // #68, measured twice on 2026-08-19: round 2 surfaced items round 1 had missed, spent the single
  // grant, and froze the verdict on findings the run then repaired. tinyproject turn3 filed mdoc errors
  // and a `var` that a re-run and a grep both showed fixed. A round that finds new work confirmed
  // nothing.
  withBudget(undefined, () => {
    consumeReviewRound();
    reviewed(['rule 17']);
    consumeReviewRound(); // confirming round #1
    reviewed(['rule 4', 'rule 8']); // not a confirmation — two items round 1 never mentioned
    consumeReviewRound(); // renewed, because the last round found something new
    __setLastReviewForTests({ state: 'reviewed', items: [{ item: 'all good', pass: true, issue: '' }] });
    assert.deepEqual(recordedVerdict(), { verdict: 'passed', failingItems: [] });
  });
});

test('renewal is capped, so a review that keeps finding new items still terminates', () => {
  withBudget(undefined, () => {
    consumeReviewRound();
    // Every round raises an item no earlier round named, which is the shape that would loop forever.
    for (const item of ['first', 'second', 'third']) {
      reviewed([item]);
      consumeReviewRound();
    }
    reviewed(['fourth']);
    assert.throws(() => consumeReviewRound(), /confirming rounds are exhausted/);
    assert.deepEqual(recordedVerdict(), { verdict: 'failed', failingItems: ['fourth'] });
  });
});

test('a clean review earns no confirming round — there is nothing to confirm', () => {
  // The round is conditional so a correct run pays nothing for it. Reviewing again after a pass would
  // spend the most expensive phase in the run to re-learn what it already knows.
  withBudget(undefined, () => {
    consumeReviewRound();
    __setLastReviewForTests({ state: 'reviewed', items: [{ item: 'all good', pass: true, issue: '' }] });
    assert.throws(() => consumeReviewRound(), /budget for this run is spent/);
  });
});

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
      // It must NOT ask for a verdict any more: the verdict is derived from the review, and an
      // instruction to file one names arguments the tool no longer accepts. turn1 followed the old
      // wording's shape and filed the opposite of what the review returned.
      assert.doesNotMatch(error.message, /reviewVerdict/);
      assert.doesNotMatch(error.message, /failingItems/);
      assert.match(error.message, /verdict comes from the review itself/);
      return true;
    });
  });
});

// recordedVerdict(): the run's outcome, derived from what the reviewer returned rather than from what
// the model says it returned. See self-report.test.ts for the report side of the same fix.
test('a review whose every item passes reads as passed', () => {
  __resetLastReviewForTests();
  __setLastReviewForTests({
    state: 'reviewed',
    items: [
      { item: 'Structure', pass: true, issue: null },
      { item: 'Coverage', pass: true, issue: null },
    ],
  });

  assert.deepEqual(recordedVerdict(), { verdict: 'passed', failingItems: [] });
});

test('a review with one failure reads as failed and names it', () => {
  __resetLastReviewForTests();
  __setLastReviewForTests({
    state: 'reviewed',
    items: [
      { item: 'Structure', pass: true, issue: null },
      { item: 'writing-style rule 12 @ Core Operations', pass: false, issue: 'bare subheader' },
    ],
  });

  assert.deepEqual(recordedVerdict(), {
    verdict: 'failed',
    failingItems: ['writing-style rule 12 @ Core Operations'],
  });
});

test('no review reads as not-reviewed, which is not the same as failed', () => {
  // A run that never reviewed has no evidence either way. Collapsing that into "failed" would be as
  // wrong as collapsing it into "passed" — the archive keeps the three states apart.
  __resetLastReviewForTests();

  assert.deepEqual(recordedVerdict(), { verdict: 'not-reviewed', failingItems: [] });
});

test('a skipped review reads as not-reviewed, not as passed', () => {
  // The skip branch returns a synthetic passing item so the phase chain stays wired for the model.
  // That item is not evidence, and a resumed run must not inherit a pass it never earned.
  __resetLastReviewForTests();
  __setLastReviewForTests({ state: 'skipped' });

  assert.deepEqual(recordedVerdict(), { verdict: 'not-reviewed', failingItems: [] });
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

// review_page is the only consumer of docKind(), so its guard is pinned here rather than in a
// run-context test file of its own.
test('docKind() refuses to guess before the request is classified', () => {
  // One review tool serves all three kinds by reading the kind from the run context. If that read
  // defaulted instead of throwing, a data type page would be reviewed against the tutorial checklist
  // and pass — a wrong checklist is worse than a stopped run.
  setRunContext({ projectPath: '/tmp/x', request: 'Write docs', kind: null, skipPhases: [] });
  assert.throws(() => docKind(), /not set yet|classified/);

  setRunContext({ projectPath: '/tmp/x', request: 'Write docs', kind: 'module', skipPhases: [] });
  assert.equal(docKind(), 'module');
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
