// The research ledger.
//
// Worth testing because the behaviour it replaces was invisible: write-module-ref-turn5 drafted Iso's
// page from a payload the model composed after Iso's research phase errored, and mdoc, the checklist
// and the reviewer all passed the result. Nothing failed, so nothing could be caught by watching for
// failures — only by refusing to draft what has no recorded research behind it.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  __resetPhaseLedgerForTests,
  operationNames,
  planShape,
  recordModulePlan,
  recordResearch,
  requireModulePlan,
  requireResearch,
} from './phase-ledger.ts';

/** A research payload with the fields these assertions touch; the rest of the schema is irrelevant here. */
function research(typeName: string, ops: string[]) {
  return {
    typeName,
    coreOperations: ops.map((name) => ({ name, category: 'Core', signature: `def ${name}: Unit`, description: '', exampleCode: '', caveats: '', source: '' })),
  } as unknown as Parameters<typeof recordResearch>[0];
}

test('recorded research comes back out', () => {
  __resetPhaseLedgerForTests();
  recordResearch(research('Prism', ['isMatching', 'modify']));
  assert.deepEqual(operationNames(requireResearch('Prism')), ['isMatching', 'modify']);
});

test('a type with no recorded research is refused, not filled in', () => {
  // turn5's Iso: research errored, nothing recorded, and the model supplied its own payload. The
  // refusal is the whole fix — this is the call that used to succeed.
  __resetPhaseLedgerForTests();
  recordResearch(research('Lens', ['get', 'set']));
  assert.throws(() => requireResearch('Iso'), /No successful research is on record for "Iso"/);
});

test('the refusal tells the model to re-run research rather than supply its own', () => {
  // The thrown message is the only prompt the model gets at this point, so it carries the next action.
  // Without that, the most likely recovery is the exact behaviour being prevented.
  __resetPhaseLedgerForTests();
  assert.throws(
    () => requireResearch('Iso'),
    (error: Error) => {
      assert.match(error.message, /Call research_data_type with typeName "Iso"/);
      assert.match(error.message, /rather than supplying\s+researchAnswers yourself/);
      return true;
    },
  );
});

test('the key tolerates the case and spacing drift between two model calls', () => {
  // The research call and the write call are separate tool invocations built by a model, so the type
  // name arrives twice and need not match byte for byte.
  __resetPhaseLedgerForTests();
  recordResearch(research('Optional', ['modify']));
  assert.equal(requireResearch(' optional ').typeName, 'Optional');
});

test('operationNames ignores order and duplicates, so relay reserialization is not a mismatch', () => {
  // Overloads share a name — Prism has three andThen — and the model reserializes the payload on its
  // way through the conversation. Neither is evidence of anything, so neither may look like a mismatch.
  const a = research('Prism', ['andThen', 'andThen', 'modify', 'isMatching']);
  const b = research('Prism', ['isMatching', 'modify', 'andThen']);
  assert.deepEqual(operationNames(a), operationNames(b));
});

test('a relayed payload with invented operations differs from the recorded one', () => {
  // The turn5 fabrication in miniature: the model relays operations that research never reported.
  // write_data_type_reference drafts from the recorded payload and logs the divergence.
  const recorded = research('Lens', ['get', 'set', 'modify']);
  const relayed = research('Lens', ['to', 'from', 'reverse', 'asLens']);
  assert.notDeepEqual(operationNames(relayed), operationNames(recorded));
});

/** A module plan with the fields the assertions touch. */
function plan(shape: string, layout: string, labels: string[]) {
  return {
    shape,
    layout,
    typeGroups: labels.map((label) => ({ label, types: [] })),
  } as unknown as Parameters<typeof recordModulePlan>[1];
}

test('a recorded module plan comes back out', () => {
  __resetPhaseLedgerForTests();
  recordModulePlan('optics', plan('core-family', 'hierarchical', ['Product Navigation']));
  assert.equal(planShape(requireModulePlan('optics')), 'core-family/hierarchical/[Product Navigation]');
});

test('a module with no designed plan is refused, not filled in', () => {
  // turn7: write_module_overview was issued in the same turn as design_module_plan and filled the
  // field itself while the designer was still working. This is the call that used to succeed.
  __resetPhaseLedgerForTests();
  assert.throws(() => requireModulePlan('optics'), /No designed plan is on record for the "optics" module/);
});

test('the module refusal says to wait for the design phase', () => {
  // The thrown string is the only prompt the model gets, and the failure mode is composing a plan
  // rather than waiting — so the message has to forbid exactly that.
  __resetPhaseLedgerForTests();
  assert.throws(
    () => requireModulePlan('optics'),
    (error: Error) => {
      assert.match(error.message, /WAIT for it to return before writing/);
      assert.match(error.message, /do not compose the plan yourself/);
      return true;
    },
  );
});

test('planShape compares the three decisions that change the output, not the whole plan', () => {
  // Layout picks the file structure, shape drives the page body, group labels decide the subpage
  // roster. Everything else drifts harmlessly when the model reserializes the plan.
  const designed = plan('core-family', 'hierarchical', ['Product Navigation', 'Sum-Type Navigation']);
  const relayed = plan('single-core', 'flat', ['Product Navigation', 'Sum-Type Navigation']);
  assert.notEqual(planShape(relayed), planShape(designed), 'a different layout must be visible');
  assert.equal(
    planShape(plan('core-family', 'hierarchical', ['Product Navigation', 'Sum-Type Navigation'])),
    planShape(designed),
    'the same decisions must compare equal',
  );
});

test('the module key tolerates case and spacing drift', () => {
  __resetPhaseLedgerForTests();
  recordModulePlan('Optics', plan('dsl', 'flat', []));
  assert.equal(planShape(requireModulePlan(' optics ')), 'dsl/flat/[]');
});
