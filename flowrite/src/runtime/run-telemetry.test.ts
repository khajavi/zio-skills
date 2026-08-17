// The flag thresholds.
//
// `computeFlags` is pure, so these are data in / flags out — no runtime, no model calls. The first
// test is the load-bearing one: a report that cries wolf on a healthy run gets ignored, and then the
// genuine flags go unread too.
import assert from 'node:assert/strict';
import test from 'node:test';

import type { ActivityReport, PhaseUsage } from './component-usage.ts';
import { computeFlags, type FlagInput } from './run-telemetry.ts';

/** A phase costing what a healthy phase costs, delegating more than it spends itself. */
const phase = (name: string, over: Partial<PhaseUsage> = {}): PhaseUsage => ({
  phase: name,
  ownTurns: 2,
  ownTokens: 20_000,
  ownCost: 0.01,
  delegateTurns: 10,
  delegateTokens: 200_000,
  delegateCost: 0.1,
  totalTokens: 220_000,
  totalCost: 0.11,
  ...over,
});

const activity = (over: Partial<ActivityReport> = {}): ActivityReport => ({
  tools: { bash: 20, read: 12, edit: 8, report_run_result: 1 },
  toolErrors: {},
  phaseFailures: {},
  skills: ['writing-style'],
  // A real clean run reviews its page, so the default fixture does too — otherwise every case would
  // trip the review-not-run flag. `review_page` is the only phase tool; other stages are `task`
  // delegations and appear in `delegations` instead.
  phaseCalls: { review_page: 1 },
  // One research delegation per drafted page is the balanced shape perTypePairing looks for.
  delegations: { researcher: 1, designer: 1, drafter: 1 },
  // Pages, which is what the pairing compares against — NOT delegations.drafter, since one drafter
  // delegation can write several pages.
  pagesWritten: 1,
  cdViolations: 0,
  ...over,
});

const input = (over: Partial<FlagInput> = {}): FlagInput => ({
  // Stage rows as a converted run produces them: one per role, delegate-only, because no relay sits in
  // front of them any more. `review_page` would be the one row carrying both halves.
  phases: [
    phase('researcher'),
    phase('designer'),
    phase('drafter'),
    // The synthetic bucket is always present in a real run, and must never be judged as a stage: it is
    // own-only, so it would trip own-exceeds-delegate on every single run. Named '(orchestration)' since
    // it now holds the root agent's whole contribution rather than the gaps between phase tools.
    phase('(orchestration)', { delegateTurns: 0, delegateTokens: 0, delegateCost: 0, ownCost: 0.2 }),
  ],
  activity: activity(),
  refusals: [],
  reportCalls: 1,
  ...over,
});

const codes = (over?: Partial<FlagInput>) => computeFlags(input(over)).map((f) => f.code);

test('a clean run produces no flags at all', () => {
  assert.deepEqual(computeFlags(input()), []);
});

test('a once-per-run phase that ran twice is flagged', () => {
  // Keeps a review call in the override so the assertion stays about the repeat, not about the
  // review-not-run flag a review-less phaseCalls map would also trip.
  //
  // design_module_plan rather than research_data_type: a module run designs its plan exactly once,
  // while the per-type phases legitimately repeat and are checked by pairing instead.
  const flags = codes({ activity: activity({ phaseCalls: { design_module_plan: 3, review_page: 1 } }) });
  assert.deepEqual(flags, ['phase-repeat']);
});

test('a module run researching and drafting five pages is not a repeat', () => {
  // The false positive this replaced: write-module-ref-turn5's counts tripped phase-repeat twice for
  // four types documented correctly. A flag that fires on a clean run gets every flag ignored.
  // A hierarchical module delegates once for the module plus once per type, and drafts the index plus
  // each subpage — balanced, so silent.
  assert.deepEqual(
    codes({
      activity: activity({
        phaseCalls: { review_page: 1 },
        delegations: { researcher: 5, designer: 1, drafter: 5, docs_integrator: 1, reviewer: 1 },
        pagesWritten: 5,
      }),
    }),
    [],
  );
});

test('a page drafted without a research delegation is flagged', () => {
  const flags = computeFlags(
    input({
      activity: activity({
        phaseCalls: { review_page: 1 },
        delegations: { researcher: 3, drafter: 4 },
        pagesWritten: 4,
      }),
    }),
  );
  assert.deepEqual(flags.map((f) => f.code), ['research-draft-mismatch']);
  assert.match(flags[0]!.detail, /4 page\(s\) drafted from 3 research delegation\(s\)/);
  assert.match(flags[0]!.detail, /without its own API surface/);
});

test('research paid for and never drafted is flagged the other way round', () => {
  const flags = computeFlags(
    input({
      activity: activity({
        phaseCalls: { review_page: 1 },
        delegations: { researcher: 4, drafter: 2 },
        pagesWritten: 2,
      }),
    }),
  );
  assert.deepEqual(flags.map((f) => f.code), ['research-draft-mismatch']);
  assert.match(flags[0]!.detail, /research paid for and never used/);
});

test('batching several pages into one drafter delegation is not a mismatch', () => {
  // write-module-ref-turn4: 3 researcher delegations (module + 2 types) and 3 pages written, but the
  // model asked for both subpages in ONE drafter delegation. Reading delegations.drafter announced
  // "3 research delegation(s) but only 2 page(s) drafted — research paid for and never used" while all
  // three pages sat on disk. Pages are what the flag names, so pages are what it counts; the batching
  // itself is a separate concern the module-subpages skill states as a rule.
  assert.deepEqual(
    codes({
      activity: activity({
        phaseCalls: { review_page: 1 },
        delegations: { researcher: 3, designer: 1, drafter: 1 },
        pagesWritten: 3,
      }),
    }),
    [],
  );
});

test('a balanced count with a failed delegation is flagged as possibly hollow', () => {
  // The precision this conversion cost, pinned so it is not mistaken for coverage. turn5's real shape
  // was 4 research calls with 1 failure against 4 drafted pages; `task_start` counts attempts, so the
  // pairing reads balanced and only the failure count reveals that a page has no API surface behind it.
  const flags = computeFlags(
    input({
      activity: activity({
        phaseCalls: { review_page: 1 },
        delegations: { researcher: 4, drafter: 4 },
        pagesWritten: 4,
        toolErrors: { task: 1 },
      }),
    }),
  );
  assert.ok(flags.some((f) => f.code === 'delegation-failures'));
  assert.match(flags.find((f) => f.code === 'delegation-failures')!.detail, /can still hide a page/);
});

test('one review round is unremarkable — it is the whole budget', () => {
  assert.deepEqual(codes({ activity: activity({ phaseCalls: { review_data_type_ref: 1 } }) }), []);
});

test('a second review round is the earned confirming pass, not a repeat', () => {
  // The default budget is one round, and a run whose review failed earns ONE more so it can record that
  // its fixes worked. That second round is correct behaviour, so flagging it would report the fix for
  // #67 as a defect — the same false-positive shape this flag already had for refused calls.
  assert.deepEqual(codes({ activity: activity({ phaseCalls: { review_module_ref: 2 } }) }), []);
});

test('review rounds beyond budget-plus-confirmation mean the cap did not hold', () => {
  // Three rounds cannot happen: consumeReviewRound throws before delegating once the budget and the one
  // confirming round are spent. So this flag reports that the cap was bypassed, a defect in the cap
  // rather than in the page.
  for (const calls of [3, 4, 7]) {
    const flags = computeFlags(
      input({ activity: activity({ phaseCalls: { review_module_ref: calls } }) }),
    );
    assert.deepEqual(flags.map((f) => f.code), ['phase-repeat'], `${calls} rounds should flag`);
    assert.match(flags[0]!.detail, /against a ceiling of 2 .* the review cap did not hold/);
  }
});

test('raising MAX_REVIEW_ROUNDS raises the flag threshold with it', () => {
  // The threshold reads the same function the cap reads, so the two cannot drift into flagging a run
  // for spending rounds it was explicitly granted.
  const previous = process.env.MAX_REVIEW_ROUNDS;
  process.env.MAX_REVIEW_ROUNDS = '3';
  try {
    // Budget 3 plus the one confirming round: 4 is legitimate, 5 is not.
    assert.deepEqual(codes({ activity: activity({ phaseCalls: { review_module_ref: 4 } }) }), []);
    assert.deepEqual(codes({ activity: activity({ phaseCalls: { review_module_ref: 5 } }) }), [
      'phase-repeat',
    ]);
  } finally {
    if (previous === undefined) delete process.env.MAX_REVIEW_ROUNDS;
    else process.env.MAX_REVIEW_ROUNDS = previous;
  }
});

test('a failed phase is flagged with what it spent', () => {
  const flags = computeFlags(
    input({ activity: activity({ phaseFailures: { designer: 2 } }) }),
  );
  assert.equal(flags.length, 1);
  assert.equal(flags[0]!.code, 'phase-failed');
  assert.match(flags[0]!.detail, /2 call\(s\) ended in error/);
  // The stage's real cost, looked up from the row, not a guess. Keyed on a role now that stage rows are
  // roles — a failure attributed to a name with no row would silently report $0.0000.
  assert.match(flags[0]!.detail, /\$0\.1100/);
});

test('guard refusals and give-ups are flagged', () => {
  assert.deepEqual(
    codes({ refusals: [{ tool: 'integrate_data_type_reference', parent: 'review_data_type_ref' }] }),
    ['guard-refusal'],
  );
  assert.deepEqual(codes({ activity: activity({ tools: { give_up: 2 } }) }), ['give-up']);
});

test('cd-ing into the repo is flagged', () => {
  assert.deepEqual(codes({ activity: activity({ cdViolations: 76 }) }), ['cd-into-repo']);
});

test('a run that never reviewed its page is flagged', () => {
  // An activity count, not a verdict: the report no longer carries pass/fail, but "nothing reviewed
  // this page at all" is still visible from the phase calls and still worth saying.
  assert.deepEqual(
    codes({ activity: activity({ phaseCalls: { research_data_type: 1, write_data_type_reference: 1 } }) }),
    ['review-not-run'],
  );
});

test('a stage outspending its own delegates is flagged', () => {
  // The measured shape of the review phase: $1.67 coordinating, $0.99 delegated. `review_page` is the
  // only stage that can still trip this — it is the last row with both halves, since every other stage
  // is a bare delegation with no relay in front of it.
  const phases = [
    ...input().phases,
    phase('review_page', { ownCost: 1.667, delegateCost: 0.989 }),
  ];
  const flags = computeFlags(input({ phases }));
  assert.deepEqual(flags.map((f) => f.code), ['own-exceeds-delegate']);
  assert.equal(flags[0]!.phase, 'review_page');
});

/*
 * The two context-bloat tests that stood here are gone with the flag (see run-telemetry.ts).
 *
 * They pinned a real threshold — 85k tokens/turn against a 10k median, and the requirement that three
 * phases exist before a median means anything. Own turns belong to a scratch conversation, and one
 * phase tool is left, so the population is `review_page` plus `(orchestration)` and the three-phase
 * guard can never clear. Keeping tests for a flag that cannot fire would assert the guard, not the
 * behaviour.
 */

test('the review cap holding is not reported as the cap failing', () => {
  // `phaseCalls` counts tool_start, so the round the budget REFUSED is in the count. Unsubtracted, this
  // flag fired on every correct run — turns 1, 2 and 3 of the tinytally data-type archive all recorded
  // "the review cap did not hold" as the direct result of it holding.
  assert.deepEqual(
    codes({
      activity: activity({
        phaseCalls: { review_page: 2 },
        phaseFailures: { review_page: 1 },
      }),
    }),
    ['phase-failed'],
    'the refused round is worth one flag, not two, and not this one',
  );
});

test('rounds that really ran past the ceiling still flag', () => {
  // The other side of the subtraction: rounds that all did work are the cap genuinely not holding. Three
  // rather than two, because two is now the earned confirming round — only the third is unreachable.
  const flags = codes({ activity: activity({ phaseCalls: { review_page: 3 } }) });
  assert.ok(flags.includes('phase-repeat'), `expected phase-repeat in ${flags.join(', ')}`);
});

test('a refiled report is flagged', () => {
  assert.deepEqual(codes({ reportCalls: 2 }), ['report-refiled']);
});

test('tool errors flag only past the threshold', () => {
  assert.deepEqual(codes({ activity: activity({ toolErrors: { edit: 2 } }) }), []);
  assert.deepEqual(codes({ activity: activity({ toolErrors: { edit: 3 } }) }), ['tool-errors']);
});
