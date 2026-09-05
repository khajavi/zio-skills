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
  // No phase tool remains — `review_page` and `fact_check_page` were the last two, and both are
  // retired — so `phaseCalls` is empty by default; a real run never populates it any more.
  phaseCalls: {},
  // A real clean run delegates to both gates on its page, so the default fixture does too —
  // otherwise every case would trip review-not-run and fact-check-not-run. One research delegation
  // per drafted page is the balanced shape perTypePairing looks for.
  delegations: { researcher: 1, designer: 1, drafter: 1, reviewer: 1, fact_checker: 1 },
  // Pages, which is what the pairing compares against — NOT delegations.drafter, since one drafter
  // delegation can write several pages.
  pagesWritten: 1,
  pagePaths: ['docs/reference/ledger.md'],
  cdViolations: 0,
  ...over,
});

const input = (over: Partial<FlagInput> = {}): FlagInput => ({
  // Stage rows as a converted run produces them: one per role, delegate-only, because no relay sits in
  // front of them any more — every stage, review and fact-check included, is a `task` delegation.
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
  // No phase tool exists any more, so this pins the generic rule against a hypothetical one: any
  // `phaseCalls` entry that is not exempted by `PER_TYPE_PHASES` and has no round budget (every entry,
  // today) is a once-per-run phase.
  const flags = codes({ activity: activity({ phaseCalls: { a_phase: 3 } }) });
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
        delegations: {
          researcher: 5,
          designer: 1,
          drafter: 5,
          docs_integrator: 1,
          reviewer: 1,
          fact_checker: 1,
        },
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
        delegations: { researcher: 3, drafter: 4, reviewer: 1, fact_checker: 1 },
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
        delegations: { researcher: 4, drafter: 2, reviewer: 1, fact_checker: 1 },
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
        delegations: { researcher: 3, designer: 1, drafter: 1, reviewer: 1, fact_checker: 1 },
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
        delegations: { researcher: 4, drafter: 4, reviewer: 1, fact_checker: 1 },
        pagesWritten: 4,
        toolErrors: { task: 1 },
      }),
    }),
  );
  assert.ok(flags.some((f) => f.code === 'delegation-failures'));
  assert.match(flags.find((f) => f.code === 'delegation-failures')!.detail, /can still hide a page/);
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
    codes({ refusals: [{ tool: 'report_run_result', parent: 'a_phase' }] }),
    ['guard-refusal'],
  );
  assert.deepEqual(codes({ activity: activity({ tools: { give_up: 2 } }) }), ['give-up']);
});

test('cd-ing into the repo is flagged', () => {
  assert.deepEqual(codes({ activity: activity({ cdViolations: 76 }) }), ['cd-into-repo']);
});

test('a run that delegated to neither gate is flagged for both', () => {
  // An activity count, not a verdict: the report no longer carries pass/fail, but "nothing reviewed
  // this page at all" is still visible from the delegation counts and still worth saying.
  //
  // Both gates get their own flag because they answer different questions — is the page good, and is
  // it true — and a run can legitimately skip one and not the other.
  assert.deepEqual(
    codes({ activity: activity({ delegations: { researcher: 1, designer: 1, drafter: 1 } }) }),
    ['review-not-run', 'fact-check-not-run'],
  );
});

test('a run that reviewed but never fact-checked is flagged for the gate it skipped', () => {
  assert.deepEqual(
    codes({
      activity: activity({ delegations: { researcher: 1, designer: 1, drafter: 1, reviewer: 1 } }),
    }),
    ['fact-check-not-run'],
  );
});

test('a stage outspending its own delegates is flagged', () => {
  // Any stage CAN trip this once it has both an own and a delegate half — every ordinary role row is
  // delegate-only today, so this exercises the mechanism with a hypothetical own-heavy 'drafter' row
  // rather than a real phase tool (none remain).
  const phases = input().phases.map((p) => (p.phase === 'drafter' ? phase('drafter', { ownCost: 1.667, delegateCost: 0.989 }) : p));
  const flags = computeFlags(input({ phases }));
  assert.deepEqual(flags.map((f) => f.code), ['own-exceeds-delegate']);
  assert.equal(flags[0]!.phase, 'drafter');
});

test('pages under two docs roots mean the run produced something unasked for', () => {
  // write-tutorial-turn1: the drafter linked to reference pages that did not exist, onBrokenLinks:'throw'
  // made the build fail, and the integrator created two stubs so the link would resolve — unreviewed
  // content, PascalCase against the kebab rule, taking the names the real pages want.
  //
  // Kind-agnostic on purpose: "one run, one docs root" needs no knowledge of which kind is running, so it
  // cannot drift out of step with one the way a rule naming `guides/` would.
  const flags = computeFlags(
    input({
      activity: activity({
        pagesWritten: 3,
        pagePaths: [
          'docs/guides/ledger-window.md',
          // Absolute, because that is the form turn1's writes actually took — the root must still resolve
          // to `reference` rather than `home`.
          '/home/u/repo/fixtures/tinyproject/docs/reference/tally/Ledger.md',
          'docs/reference/tally/Window.md',
        ],
      }),
    }),
  );
  assert.ok(flags.some((f) => f.code === 'pages-outside-one-root'));
  assert.match(flags.find((f) => f.code === 'pages-outside-one-root')!.detail, /guides, reference/);
});

test('a hierarchical module writing an index and subpages stays under one root', () => {
  // The shape this must NOT flag: three pages, one root, which is every correct module run.
  assert.deepEqual(
    codes({
      activity: activity({
        pagesWritten: 3,
        pagePaths: [
          'docs/reference/tally/index.md',
          'docs/reference/tally/ledger.md',
          'docs/reference/tally/window.md',
        ],
        delegations: { researcher: 3, designer: 1, drafter: 3, reviewer: 1, fact_checker: 1 },
      }),
    }),
    [],
  );
});

test('a page directly in docs/ is not a second root', () => {
  // docs/index.md has no root segment; counting it as one would flag every run that touches the index.
  assert.deepEqual(
    codes({
      activity: activity({
        pagesWritten: 2,
        pagePaths: ['docs/index.md', 'docs/reference/tally/ledger.md'],
        delegations: { researcher: 2, designer: 1, drafter: 1, reviewer: 1, fact_checker: 1 },
      }),
    }),
    [],
  );
});

test('a refiled report is flagged', () => {
  assert.deepEqual(codes({ reportCalls: 2 }), ['report-refiled']);
});

test('tool errors flag only past the threshold', () => {
  assert.deepEqual(codes({ activity: activity({ toolErrors: { edit: 2 } }) }), []);
  assert.deepEqual(codes({ activity: activity({ toolErrors: { edit: 3 } }) }), ['tool-errors']);
});
