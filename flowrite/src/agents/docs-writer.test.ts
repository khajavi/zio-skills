// Invariants of the KINDS table. Pure data assertions — no Flue runtime, no model calls, so they
// run in milliseconds via `npm test`.
//
// Worth having because the merge moved three files' worth of wiring into one table: a mistake here
// is now a mistake in every kind of document, and most of it fails at runtime rather than at `tsc`
// (a mistyped label breaks log archiving silently; a duplicate tool throws only when the agent
// renders).
import assert from 'node:assert/strict';
import test from 'node:test';

import { DOC_KINDS, KINDS } from './docs-writer.ts';

test('every kind is fully configured', () => {
  for (const kind of DOC_KINDS) {
    const config = KINDS[kind];
    assert.ok(config.instructions.length > 0, `${kind} has instructions`);
    assert.ok(config.skills.length > 0, `${kind} has skills`);
    assert.ok(config.tools.length > 0, `${kind} has phase tools`);
  }
});

test('every directive interpolates the subject', () => {
  for (const kind of DOC_KINDS) {
    assert.match(KINDS[kind].directive('SubjectMarker', {}), /SubjectMarker/, kind);
  }
});

test('labels match what archive-docs.sh greps for', () => {
  // These strings drive the archive script's log parsing (`<label> token consumption:`,
  // `<label> run insights:`), so a typo breaks archiving silently rather than loudly.
  assert.equal(KINDS['data-type'].label, 'write-data-type-ref');
  assert.equal(KINDS.module.label, 'write-module-ref');
  assert.equal(KINDS.tutorial.label, 'write-tutorial');
});

test('no kind mounts the same tool twice', () => {
  // `useTool` throws ToolNameConflictError on duplicates, and the module kind deliberately reuses
  // three data-type tools — so this is a live hazard, not a hypothetical one.
  for (const kind of DOC_KINDS) {
    const names = KINDS[kind].tools.map((tool) => tool.name);
    assert.deepEqual([...new Set(names)].sort(), [...names].sort(), `${kind} has duplicate tools`);
  }
});

test('no kind mounts the same skill twice', () => {
  // Same rule for skills: mounting one name twice in a render throws.
  for (const kind of DOC_KINDS) {
    const names = KINDS[kind].skills.map((skill) => skill.name);
    assert.deepEqual([...new Set(names)].sort(), [...names].sort(), `${kind} has duplicate skills`);
  }
});

test('the module escape hatches reach the directive', () => {
  // layout/shapeOverride survive only in creation data — no sentence can express them with schema
  // validation — and run-module-ref.sh passes them when testing a forced layout.
  const directive = KINDS.module.directive('optics', {
    layout: 'hierarchical',
    shapeOverride: 'core-family',
  });
  assert.match(directive, /hierarchical/);
  assert.match(directive, /core-family/);

  // Absent by default: an unforced run must not mention a layout at all, or the design phase's
  // auto-rule gets pre-empted by the prompt.
  const plain = KINDS.module.directive('optics', {});
  assert.doesNotMatch(plain, /layout/);
});
