// The module design phase's recording of its own plan.
//
// This test exists because the assertion it replaces did not catch a shipped bug. phase-ledger.test.ts
// exercises recordModulePlan and requireModulePlan directly, so it passed while the WIRING was broken:
// designPlan took an `onResult` callback that was invoked in the skip branch only, so a successful
// design recorded nothing and write_module_overview refused a plan that had in fact been designed.
// tinytally's first run found it — design finished, the write was refused twice, and the model wrote
// the page by hand.
//
// So this drives the real tool through a fake harness. Testing the ledger proved the ledger works;
// only testing the tool proves the phase uses it.
import assert from 'node:assert/strict';
import test from 'node:test';

import { designModulePlan } from './design-doc-plan.ts';
import { __resetPhaseLedgerForTests, planShape, requireModulePlan } from './phase-ledger.ts';
import { setRunContext } from '../../runtime/run-context.ts';

/** A plan the fake designer returns. Only the three fields planShape compares matter here. */
const designed = {
  shape: 'core-family',
  layout: 'hierarchical',
  layoutRationale: 'two co-equal types',
  optionalSections: {
    motivation: true,
    installation: false,
    overview: true,
    howTheyWorkTogether: true,
    commonPatterns: false,
    integration: false,
    runningExamples: false,
  },
  typeGroups: [{ label: 'Counting', types: [{ name: 'Ledger', kind: 'core' }] }],
  comparisons: [],
  notes: null,
};

/** A harness whose scratch conversation always answers with `designed`. */
const fakeHarness = () =>
  ({ prompt: () => Promise.resolve({ data: designed }) }) as never;

const ctx = (moduleName: string) =>
  ({
    harness: fakeHarness(),
    log: { info: () => {}, warn: () => {}, error: () => {} },
    data: { moduleName, researchAnswers: { moduleName } },
    // Cast to the tool's own context type: only the three fields designModulePlan reads are supplied,
    // and moduleResearchSchema's other fifteen are irrelevant to what this asserts.
  }) as unknown as Parameters<typeof designModulePlan.run>[0];

test('a successful module design records its plan for the write phase', async () => {
  __resetPhaseLedgerForTests();
  setRunContext({ projectPath: '/tmp', kind: 'module', request: 'document tally', skipPhases: [] });

  await designModulePlan.run(ctx('tally'));

  // The assertion the callback version failed: after a real design, the plan is on record.
  assert.equal(planShape(requireModulePlan('tally')), 'core-family/hierarchical/[Counting]');
});

test('a skipped module design still records, so a resumed run can write', async () => {
  // skipPhases is how a run resumes with artifacts already on disk. The write phase runs in that
  // resumed run and must not be refused, so the skip default has to reach the ledger too — which is
  // exactly the branch the broken callback version got right and the success path got wrong.
  __resetPhaseLedgerForTests();
  setRunContext({ projectPath: '/tmp', kind: 'module', request: 'document tally', skipPhases: ['design'] });

  await designModulePlan.run(ctx('tally'));

  assert.doesNotThrow(() => requireModulePlan('tally'));
});
