// The fact-check gate: its round budget, how a drift reaches the run's verdict, and the section
// splitting that decides what any of it actually looked at.
//
// Worth testing because every part of it fails silently. A budget that does not bind restores an
// unbounded loop; a `low`-only report that blocks fails correct pages; a splitter that drops the
// preamble leaves the page's headline signature unchecked while reporting the page clean.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PREAMBLE,
  __resetFactCheckRoundsForTests,
  __resetLastFactCheckForTests,
  __setLastFactCheckForTests,
  chunkSections,
  consumeFactCheckRound,
  mergeReports,
  recordedFactCheck,
  splitSections,
} from './fact-check.ts';
import {
  __resetLastReviewForTests,
  __setLastReviewForTests,
  recordedVerdict,
} from './review-page.ts';
import { maxFactCheckRounds } from '../../runtime/run-context.ts';

/** Run `fn` with MAX_FACT_CHECK_ROUNDS set to `value`, restoring the environment afterwards. */
function withBudget(value: string | undefined, fn: () => void): void {
  const previous = process.env.MAX_FACT_CHECK_ROUNDS;
  if (value === undefined) delete process.env.MAX_FACT_CHECK_ROUNDS;
  else process.env.MAX_FACT_CHECK_ROUNDS = value;
  __resetFactCheckRoundsForTests();
  // Also clear the recorded outcome: consumeFactCheckRound reads it to decide whether a confirming
  // round is owed, so a drifting outcome left by an earlier test would grant one and make a budget
  // assertion pass for the wrong reason.
  __resetLastFactCheckForTests();
  try {
    fn();
  } finally {
    if (previous === undefined) delete process.env.MAX_FACT_CHECK_ROUNDS;
    else process.env.MAX_FACT_CHECK_ROUNDS = previous;
    __resetFactCheckRoundsForTests();
    __resetLastFactCheckForTests();
  }
}

/**
 * A drift of the given severity, with the citations a real one must carry.
 *
 * `source` is the identity across rounds (see `driftKey`), so it is a parameter: two drifts with the
 * same source are the same problem reported twice, and two with different sources are not.
 */
function drift(
  severity: 'high' | 'medium' | 'low',
  source = 'tally/src/main/scala/tally/Ledger.scala:L24-L26',
) {
  return {
    kind: 'contradicted' as const,
    severity,
    claim: 'Returns `Option[Ledger]`.',
    documented: 'docs/reference/ledger.md:42',
    source,
    detail: 'the page says absorb returns Option[Ledger]; the source returns Ledger',
    fix: 'state the return type as Ledger',
  };
}

/** Record a completed check with the given drifts and no incompleteness. */
function checked(...drifts: ReturnType<typeof drift>[]): void {
  __setLastFactCheckForTests({ state: 'checked', drifts, incomplete: null });
}

/** A passing review, so a verdict assertion isolates the fact-check's contribution. */
function reviewPassed(): void {
  __setLastReviewForTests({
    state: 'reviewed',
    items: [{ item: 'Structure', pass: true, issue: null }],
  });
}

// ---------------------------------------------------------------------------- budget

test('the default budget is one round', () => {
  withBudget(undefined, () => {
    assert.equal(maxFactCheckRounds(), 1);
    consumeFactCheckRound();
    assert.throws(() => consumeFactCheckRound(), /budget for this run is spent \(1 round, all used\)/);
  });
});

test('a check that found drift earns one confirming round, so fixes can be recorded as verified', () => {
  // The same defect the review side carries: recordedFactCheck() returns the LAST outcome and a
  // refused call records none, so under a hard budget of one a run that repaired every drift would
  // still file the pre-fix result — and then be told, correctly, not to describe the page as correct.
  withBudget(undefined, () => {
    consumeFactCheckRound();
    checked(drift('high'));
    consumeFactCheckRound(); // granted, because the last check found something
    checked(); // clean this time
    reviewPassed();
    assert.deepEqual(recordedVerdict(), { verdict: 'passed', failingItems: [] });
  });
});

test('a round that repeats the same drift ends the run', () => {
  // It confirmed what it could: the page it judged IS the page the model fixed, and it still reports
  // the same problem. A third opinion would find the same page.
  withBudget(undefined, () => {
    consumeFactCheckRound();
    checked(drift('high'));
    consumeFactCheckRound();
    checked(drift('high'));
    assert.throws(() => consumeFactCheckRound(), (error: Error) => {
      assert.match(error.message, /plus 1 confirming round, all used/);
      assert.match(error.message, /repeated drifts the one before it already reported/);
      return true;
    });
  });
});

test('a round that finds NEW drifts earns another, so the verdict cannot freeze on repaired findings', () => {
  // Mirrors the review-side defect measured on two runs: round 2 raises what round 1 missed, spends
  // the single grant, and the verdict freezes on findings the run then repaired. A round that found
  // something new confirmed nothing — the page it judged is not the page the model went on to fix.
  withBudget(undefined, () => {
    consumeFactCheckRound();
    checked(drift('high', 'tally/src/main/scala/tally/Ledger.scala:L24-L26'));
    consumeFactCheckRound(); // first confirming round
    checked(drift('high', 'tally/src/main/scala/tally/Window.scala:L30-L32')); // a different member
    consumeFactCheckRound(); // renewed, because that drift is new
    checked();
    reviewPassed();
    assert.deepEqual(recordedVerdict(), { verdict: 'passed', failingItems: [] });
  });
});

test('the renewal is capped, so a page that keeps producing new drifts still terminates', () => {
  withBudget(undefined, () => {
    consumeFactCheckRound();
    // Each round finds a drift in a member no earlier round mentioned, so each renews the grant.
    for (let i = 0; i < 3; i++) {
      checked(drift('high', `tally/src/main/scala/tally/Type${i}.scala:L1-L2`));
      consumeFactCheckRound();
    }
    checked(drift('high', 'tally/src/main/scala/tally/Type99.scala:L1-L2'));
    assert.throws(() => consumeFactCheckRound(), /confirming rounds are exhausted/i);
  });
});

test('an incomplete round counts as a finding for the renewal, not as a repeat', () => {
  // A round that could not look, then looked and found something, has found something new by any
  // reading that matters — the earlier round observed nothing to repeat.
  withBudget(undefined, () => {
    consumeFactCheckRound();
    __setLastFactCheckForTests({ state: 'checked', drifts: [], incomplete: 'source root missing' });
    consumeFactCheckRound();
    checked(drift('high'));
    consumeFactCheckRound(); // renewed: a real drift is new against an incomplete round
    checked();
    reviewPassed();
    assert.deepEqual(recordedVerdict(), { verdict: 'passed', failingItems: [] });
  });
});

test('a clean check earns no confirming round — there is nothing to confirm', () => {
  withBudget(undefined, () => {
    consumeFactCheckRound();
    checked();
    assert.throws(() => consumeFactCheckRound(), /budget for this run is spent/);
  });
});

test('an incomplete check earns the confirming round too', () => {
  // "Could not look" is a reason to look again, unlike a clean result. Without this a transient
  // failure — an unreadable file, a source root not yet built — permanently records the page as
  // unverified with no way to retry.
  withBudget(undefined, () => {
    consumeFactCheckRound();
    __setLastFactCheckForTests({ state: 'checked', drifts: [], incomplete: 'source root missing' });
    consumeFactCheckRound();
    checked();
    reviewPassed();
    assert.deepEqual(recordedVerdict(), { verdict: 'passed', failingItems: [] });
  });
});

test('the refusal tells the model what to do instead', () => {
  // The thrown message is the only prompt the model gets at this point, so it has to carry the next
  // action. It must not ask for a verdict: the verdict is derived, and an instruction to file one
  // names arguments no tool accepts.
  withBudget(undefined, () => {
    consumeFactCheckRound();
    assert.throws(() => consumeFactCheckRound(), (error: Error) => {
      assert.match(error.message, /Do not call fact check again/);
      assert.match(error.message, /Fix every drift/);
      assert.match(error.message, /verdict comes from the check itself/);
      assert.doesNotMatch(error.message, /reviewVerdict/);
      return true;
    });
  });
});

test('a junk MAX_FACT_CHECK_ROUNDS falls back to one rather than to unlimited', () => {
  for (const junk of ['0', '-2', 'many', '2.5', '']) {
    withBudget(junk, () => {
      assert.equal(maxFactCheckRounds(), 1, `MAX_FACT_CHECK_ROUNDS=${JSON.stringify(junk)} should fall back to 1`);
    });
  }
});

// ---------------------------------------------------------------------------- verdict

test('a high drift fails a run whose review passed', () => {
  // The whole point of the phase. A page can satisfy every checklist item and every style rule while
  // describing a method the library does not have.
  __resetLastFactCheckForTests();
  __resetLastReviewForTests();
  reviewPassed();
  checked(drift('high'));

  const verdict = recordedVerdict();
  assert.equal(verdict.verdict, 'failed');
  assert.equal(verdict.failingItems.length, 1);
  assert.match(verdict.failingItems[0]!, /^fact-check \(high\/contradicted\)/);
  // Both citations survive into the item, so the archive can be read without re-running anything.
  assert.match(verdict.failingItems[0]!, /docs\/reference\/ledger\.md:42/);
  assert.match(verdict.failingItems[0]!, /Ledger\.scala:L24-L26/);
});

test('a medium drift also fails the run', () => {
  __resetLastFactCheckForTests();
  __resetLastReviewForTests();
  reviewPassed();
  checked(drift('medium'));

  assert.equal(recordedVerdict().verdict, 'failed');
});

test('a low drift is reported but does not by itself fail the run', () => {
  // Severity is authored by the model and nothing calibrates it. The class where a false positive is
  // likeliest — an accurate claim whose cited lines moved — is named without failing a correct page.
  __resetLastFactCheckForTests();
  __resetLastReviewForTests();
  reviewPassed();
  checked(drift('low'));

  assert.deepEqual(recordedVerdict().verdict, 'passed');
  assert.equal(recordedVerdict().failingItems.length, 1);
});

test('an incomplete check fails the run — "could not look" is not "no drift"', () => {
  __resetLastFactCheckForTests();
  __resetLastReviewForTests();
  reviewPassed();
  __setLastFactCheckForTests({ state: 'checked', drifts: [], incomplete: 'Ledger.scala would not read' });

  const verdict = recordedVerdict();
  assert.equal(verdict.verdict, 'failed');
  assert.match(verdict.failingItems[0]!, /could not complete: Ledger\.scala would not read/);
});

test('a skipped fact-check gates nothing, like a skipped review', () => {
  // Skipping is a human decision to resume a run. It produces no evidence, so it must neither fail a
  // page nor vouch for one.
  __resetLastFactCheckForTests();
  __resetLastReviewForTests();
  reviewPassed();
  __setLastFactCheckForTests({ state: 'skipped' });

  assert.deepEqual(recordedVerdict(), { verdict: 'passed', failingItems: [] });
  assert.deepEqual(recordedFactCheck(), { state: 'skipped', failingItems: [], blocking: false });
});

test('a fact-check that never ran gates nothing', () => {
  __resetLastFactCheckForTests();
  __resetLastReviewForTests();
  reviewPassed();

  assert.deepEqual(recordedVerdict(), { verdict: 'passed', failingItems: [] });
  assert.deepEqual(recordedFactCheck(), { state: 'none', failingItems: [], blocking: false });
});

test('drift cannot rescue or fail a run that was never reviewed, but is still named', () => {
  // `not-reviewed` claims nothing in either direction, so a fact-check cannot move it. The drifts are
  // listed anyway: a run with no review and a failed fact-check should not read as empty.
  __resetLastFactCheckForTests();
  __resetLastReviewForTests();
  checked(drift('high'));

  const verdict = recordedVerdict();
  assert.equal(verdict.verdict, 'not-reviewed');
  assert.equal(verdict.failingItems.length, 1);
});

test('review failures and drifts appear in one list, tellable apart', () => {
  __resetLastFactCheckForTests();
  __resetLastReviewForTests();
  __setLastReviewForTests({
    state: 'reviewed',
    items: [{ item: 'writing-style rule 12', pass: false, issue: 'bare subheader' }],
  });
  checked(drift('high'));

  const { verdict, failingItems } = recordedVerdict();
  assert.equal(verdict, 'failed');
  assert.equal(failingItems.length, 2);
  assert.equal(failingItems[0], 'writing-style rule 12');
  assert.match(failingItems[1]!, /^fact-check /);
});

// ---------------------------------------------------------------------------- sections

const PAGE = [
  '---',
  'id: ledger',
  '---',
  '',
  '# Ledger',
  '',
  '`Ledger` accumulates counts.',
  '',
  '```scala',
  'final case class Ledger(entries: Map[String, Long])',
  '```',
  '',
  '## Usage',
  '',
  'Some usage.',
  '',
  '## Core Operations',
  '',
  '### Accumulating',
  '',
  '#### record',
  '',
  'Adds one.',
  '',
  '## Comparison',
  '',
  'Versus Tally.',
].join('\n');

test('the text before the first heading is its own section', () => {
  // A reference page opens with its definition and the type's headline signature BEFORE any heading.
  // Dropping the preamble would leave the single most load-bearing signature on the page unchecked
  // while the phase reported the page clean.
  const sections = splitSections(PAGE);

  assert.equal(sections[0]!.heading, PREAMBLE);
  assert.match(sections[0]!.body, /final case class Ledger/);
});

test('splitting is on `##` only, so a method keeps its own signature block', () => {
  // `###`/`####` are the per-capability subsections inside Core Operations. Splitting there would cut
  // a method's prose away from the signature it describes — exactly the pair a checker must see
  // together.
  const headings = splitSections(PAGE).map((section) => section.heading);

  assert.deepEqual(headings, [PREAMBLE, 'Usage', 'Core Operations', 'Comparison']);
  const coreOps = splitSections(PAGE).find((section) => section.heading === 'Core Operations')!;
  assert.match(coreOps.body, /#### record/);
  assert.match(coreOps.body, /Adds one\./);
});

test('splitting loses no lines', () => {
  // The cheapest guard against the whole class of "the checker reported clean on text it never saw".
  const rejoined = splitSections(PAGE)
    .map((section) => section.body)
    .join('\n');

  assert.equal(rejoined.trim(), PAGE.trim());
});

test('chunking groups consecutive sections up to the character budget', () => {
  const sections = [
    { heading: 'a', body: 'x'.repeat(30) },
    { heading: 'b', body: 'x'.repeat(30) },
    { heading: 'c', body: 'x'.repeat(30) },
  ];

  assert.deepEqual(
    chunkSections(sections, 70).map((chunk) => chunk.map((section) => section.heading)),
    [['a', 'b'], ['c']],
  );
});

test('a section larger than the budget stands alone rather than being cut', () => {
  // It cannot be split further without separating prose from the signature it describes, so the
  // delegate gets a fuller window instead of a broken pair.
  const sections = [
    { heading: 'small', body: 'x'.repeat(10) },
    { heading: 'huge', body: 'x'.repeat(500) },
  ];

  assert.deepEqual(
    chunkSections(sections, 100).map((chunk) => chunk.map((section) => section.heading)),
    [['small'], ['huge']],
  );
});

test('merging is clean only when nothing drifted and nothing was missed', () => {
  const clean = { clean: true, sectionsChecked: ['Usage'], drifts: [], incomplete: null };

  assert.equal(mergeReports([clean, clean], []).clean, true);
  assert.equal(mergeReports([clean, { ...clean, drifts: [drift('low')] }], []).clean, false);
  assert.equal(mergeReports([clean, { ...clean, incomplete: 'nope' }], []).clean, false);
});

test('sections dropped by the chunk cap are reported as incomplete, never as clean', () => {
  // The failure this prevents: a long module page whose tail is silently unchecked, reported clean.
  const clean = { clean: true, sectionsChecked: ['Usage'], drifts: [], incomplete: null };
  const merged = mergeReports([clean], ['Advanced Usage', 'Integration']);

  assert.equal(merged.clean, false);
  assert.match(merged.incomplete!, /chunk budget ran out: Advanced Usage, Integration/);
});
