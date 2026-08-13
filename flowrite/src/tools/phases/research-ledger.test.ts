// The research ledger.
//
// Worth testing because the behaviour it replaces was invisible: write-module-ref-turn5 drafted Iso's
// page from a payload the model composed after Iso's research phase errored, and mdoc, the checklist
// and the reviewer all passed the result. Nothing failed, so nothing could be caught by watching for
// failures — only by refusing to draft what has no recorded research behind it.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  __resetResearchLedgerForTests,
  operationNames,
  recordResearch,
  requireResearch,
} from './research-ledger.ts';

/** A research payload with the fields these assertions touch; the rest of the schema is irrelevant here. */
function research(typeName: string, ops: string[]) {
  return {
    typeName,
    coreOperations: ops.map((name) => ({ name, category: 'Core', signature: `def ${name}: Unit`, description: '', exampleCode: '', caveats: '', source: '' })),
  } as unknown as Parameters<typeof recordResearch>[0];
}

test('recorded research comes back out', () => {
  __resetResearchLedgerForTests();
  recordResearch(research('Prism', ['isMatching', 'modify']));
  assert.deepEqual(operationNames(requireResearch('Prism')), ['isMatching', 'modify']);
});

test('a type with no recorded research is refused, not filled in', () => {
  // turn5's Iso: research errored, nothing recorded, and the model supplied its own payload. The
  // refusal is the whole fix — this is the call that used to succeed.
  __resetResearchLedgerForTests();
  recordResearch(research('Lens', ['get', 'set']));
  assert.throws(() => requireResearch('Iso'), /No successful research is on record for "Iso"/);
});

test('the refusal tells the model to re-run research rather than supply its own', () => {
  // The thrown message is the only prompt the model gets at this point, so it carries the next action.
  // Without that, the most likely recovery is the exact behaviour being prevented.
  __resetResearchLedgerForTests();
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
  __resetResearchLedgerForTests();
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
