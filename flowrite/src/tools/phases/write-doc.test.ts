// Whether a drafter is handed a plan.
//
// Worth testing because the first attempt at this rule shipped, passed tsc, passed 47 tests, and did
// nothing: `write-module-ref-turn5` supplied a fabricated plan on 4 of 4 subpage calls. Making the
// field optional and asking the model to omit it are both advisory — the enforcement is here, in the
// prompt the drafter actually receives, so that is what these assertions read.
import assert from 'node:assert/strict';
import test from 'node:test';

import { planBlock } from './write-doc.ts';

/** A minimal plan. Only its identity matters here, never its contents. */
const plan = {
  optionalSections: {
    motivation: true,
    installation: false,
    predefinedInstances: false,
    subtypes: false,
    comparisons: true,
    advancedUsage: false,
    integration: false,
    runningExamples: false,
  },
  constructionOrder: ['Iso.apply'],
  coreOperationCategories: [{ category: 'Conversion', methods: ['to', 'from'] }],
  comparisons: ['Lens'],
  notes: '',
};

test('a standalone page gets the plan its design phase produced', () => {
  const block = planBlock({ plan }).join('\n');
  assert.match(block, /Plan to follow exactly/);
  assert.match(block, /Iso\.apply/, 'the plan itself must reach the drafter');
});

test('a module subpage gets no plan, even when one is supplied', () => {
  // The exact shape of the turn5 calls: a plan the model composed, alongside the module context that
  // identifies the page as a subpage. Both halves matter — the plan must be dropped, and the drafter
  // must be told to decide the structure itself rather than left with an unexplained gap.
  const block = planBlock({ plan, moduleContext: 'Iso is a core type in Product Navigation' }).join('\n');
  assert.doesNotMatch(block, /Plan to follow exactly/);
  assert.doesNotMatch(block, /Iso\.apply/, 'a composed plan must not reach the drafter');
  assert.match(block, /No plan accompanies this page/);
});

test('a standalone page with no plan says so rather than going silent', () => {
  // Reachable only if design is skipped for a data-type run; the drafter still needs to know why it
  // has no plan, because an unexplained absence is what it improvises around.
  const block = planBlock({}).join('\n');
  assert.match(block, /No plan accompanies this page/);
});
