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
  // A real clean run reviews its page, so the default fixture does too — otherwise every case
  // would trip the review-not-run flag.
  phaseCalls: {
    research_data_type: 1,
    design_data_type_plan: 1,
    write_data_type_reference: 1,
    review_data_type_ref: 1,
  },
  cdViolations: 0,
  ...over,
});

const input = (over: Partial<FlagInput> = {}): FlagInput => ({
  phases: [
    phase('research_data_type'),
    phase('design_data_type_plan'),
    phase('write_data_type_reference'),
    // The synthetic bucket is always present in a real run, and must never be judged as a phase:
    // it has no delegates, so it would trip own-exceeds-delegate on every single run.
    phase('(between phases)', { delegateTurns: 0, delegateTokens: 0, delegateCost: 0, ownCost: 0.2 }),
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

test('a module run researching and drafting four subpages is not a repeat', () => {
  // The false positive this replaced: write-module-ref-turn5's own counts, which tripped phase-repeat
  // twice for four types documented correctly. A flag that fires on a clean run gets every flag
  // ignored.
  assert.deepEqual(
    codes({
      activity: activity({
        phaseCalls: {
          research_module: 1,
          design_module_plan: 1,
          write_module_overview: 1,
          research_data_type: 4,
          write_data_type_reference: 4,
          review_page: 1,
        },
      }),
    }),
    [],
  );
});

test('a page drafted without successful research is flagged', () => {
  // turn5's real arithmetic: 4 research calls, 1 of which errored, against 4 drafted pages. phaseCalls
  // counts tool_start, so the failure is inside the 4 — leaving one subpage with no API surface behind
  // it. This is what the count check was standing in front of.
  const flags = computeFlags(
    input({
      activity: activity({
        phaseCalls: { research_data_type: 4, write_data_type_reference: 4, review_page: 1 },
        phaseFailures: { research_data_type: 1 },
      }),
    }),
  );
  assert.deepEqual(
    flags.map((f) => f.code).sort(),
    ['phase-failed', 'research-draft-mismatch'],
    'the failure and the unpaired page are separate facts',
  );
  const mismatch = flags.find((f) => f.code === 'research-draft-mismatch')!;
  assert.match(mismatch.detail, /4 page\(s\) drafted from 3 successful research call\(s\)/);
  assert.match(mismatch.detail, /without its own API surface/);
});

test('research paid for and never drafted is flagged the other way round', () => {
  const flags = computeFlags(
    input({
      activity: activity({
        phaseCalls: { research_data_type: 4, write_data_type_reference: 2, review_page: 1 },
      }),
    }),
  );
  assert.deepEqual(flags.map((f) => f.code), ['research-draft-mismatch']);
  assert.match(flags[0]!.detail, /research paid for and never used/);
});

test('one review round is unremarkable — it is the whole budget', () => {
  assert.deepEqual(codes({ activity: activity({ phaseCalls: { review_data_type_ref: 1 } }) }), []);
});

test('review rounds beyond the budget mean the cap did not hold', () => {
  // Under the default budget of one, a second round should be impossible: consumeReviewRound throws
  // before delegating. So this flag no longer reports a slow-converging loop — it reports that the cap
  // was bypassed, which is a defect in the cap rather than in the page.
  for (const calls of [2, 4, 7]) {
    const flags = computeFlags(
      input({ activity: activity({ phaseCalls: { review_module_ref: calls } }) }),
    );
    assert.deepEqual(flags.map((f) => f.code), ['phase-repeat'], `${calls} rounds should flag`);
    assert.match(flags[0]!.detail, /against a budget of 1 — the review cap did not hold/);
  }
});

test('raising MAX_REVIEW_ROUNDS raises the flag threshold with it', () => {
  // The threshold reads the same function the cap reads, so the two cannot drift into flagging a run
  // for spending rounds it was explicitly granted.
  const previous = process.env.MAX_REVIEW_ROUNDS;
  process.env.MAX_REVIEW_ROUNDS = '3';
  try {
    assert.deepEqual(codes({ activity: activity({ phaseCalls: { review_module_ref: 3 } }) }), []);
    assert.deepEqual(codes({ activity: activity({ phaseCalls: { review_module_ref: 4 } }) }), [
      'phase-repeat',
    ]);
  } finally {
    if (previous === undefined) delete process.env.MAX_REVIEW_ROUNDS;
    else process.env.MAX_REVIEW_ROUNDS = previous;
  }
});

test('a failed phase is flagged with what it spent', () => {
  const flags = computeFlags(
    input({ activity: activity({ phaseFailures: { design_data_type_plan: 2 } }) }),
  );
  assert.equal(flags.length, 1);
  assert.equal(flags[0]!.code, 'phase-failed');
  assert.match(flags[0]!.detail, /2 call\(s\) ended in error/);
  assert.match(flags[0]!.detail, /\$0\.1100/); // the phase's real cost, not a guess
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

test('a phase outspending its own delegates is flagged', () => {
  // The measured shape of the review phase: $1.67 coordinating, $0.99 delegated.
  const phases = input().phases.map((p) =>
    p.phase === 'write_data_type_reference' ? { ...p, ownCost: 1.667, delegateCost: 0.989 } : p,
  );
  const flags = computeFlags(input({ phases }));
  assert.deepEqual(flags.map((f) => f.code), ['own-exceeds-delegate']);
  assert.equal(flags[0]!.phase, 'write_data_type_reference');
});

test('a context-bloated phase is flagged, and only that phase', () => {
  // 85k tokens/turn against a 10k median — the review phase's real profile.
  const phases = input().phases.map((p) =>
    p.phase === 'write_data_type_reference'
      ? { ...p, ownTurns: 38, ownTokens: 38 * 85_000, ownCost: 0.05 }
      : { ...p, ownTurns: 2, ownTokens: 20_000 },
  );
  const flags = computeFlags(input({ phases }));
  assert.deepEqual(flags.map((f) => f.code), ['context-bloat']);
  assert.equal(flags[0]!.phase, 'write_data_type_reference');
  assert.match(flags[0]!.detail, /85k tokens per own turn/);
});

test('bloat needs at least three phases to have a baseline', () => {
  // A one-phase run has no median to be an outlier against, so a huge single phase must not flag.
  // This is the only threshold that depends on the rest of the run, so it is the only one that can
  // misfire on a short run.
  const flags = codes({
    phases: [phase('research_data_type', { ownTurns: 1, ownTokens: 900_000 })],
    activity: activity({ phaseCalls: { research_data_type: 1 } }),
  });
  // Asserts the absence of this one flag rather than of all flags: a research-only run legitimately
  // trips review-not-run, and that has nothing to do with the threshold under test.
  assert.ok(!flags.includes('context-bloat'), `unexpected bloat flag in ${flags.join(', ')}`);
});

test('a refiled report is flagged', () => {
  assert.deepEqual(codes({ reportCalls: 2 }), ['report-refiled']);
});

test('tool errors flag only past the threshold', () => {
  assert.deepEqual(codes({ activity: activity({ toolErrors: { edit: 2 } }) }), []);
  assert.deepEqual(codes({ activity: activity({ toolErrors: { edit: 3 } }) }), ['tool-errors']);
});
