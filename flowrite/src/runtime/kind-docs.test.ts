// Per-kind reference docs reaching a role through its own render.
//
// Worth testing because a role reads `docKind()` at its own render and returns the matching document
// with its instructions. tsc checks that the call compiles, not that the correct document arrives — and
// "the wrong kind's template, silently" is exactly the failure this route can produce.
//
// `Designer()` is exercised directly because it calls no hooks. `Drafter()` calls `useSkill`, which
// throws outside a render, so its content selection is covered through `structureBlock` and
// `styleBlock` below; the one line that joins them is tsc's business.
import assert from 'node:assert/strict';
import test from 'node:test';

import { CHECKLISTS, STRUCTURES, STYLE_RULES, structureBlock, styleBlock } from './kind-docs.ts';
import { DOC_KINDS, type DocKind, setRunContext } from './run-context.ts';
import { Designer } from '../subagents/designer.ts';

/** Put the run in `kind`, with the other context fields at values nothing here reads. */
const withKind = (kind: DocKind) =>
  setRunContext({ projectPath: '/tmp', request: 'document something', kind, skipPhases: [] });

test('every kind has a structure template and a checklist', () => {
  // A missing entry would hand a role an empty template and read as a model failure.
  for (const kind of DOC_KINDS) {
    assert.ok(STRUCTURES[kind].length > 100, `${kind} structure is suspiciously short`);
    assert.ok(CHECKLISTS[kind].length > 100, `${kind} checklist is suspiciously short`);
  }
});

test('the structures are distinct documents, pairwise', () => {
  // The bug this catches: one kind's map entry pointing at another kind's import. Both would be
  // long, non-empty and plausible, and only a page reviewed against the wrong template would show it.
  //
  // A loop over pairs rather than a hand-written triangle: as three named assertions this covered
  // nothing a fourth kind added, which is how it stood when `how-to` arrived.
  for (const a of DOC_KINDS) {
    for (const b of DOC_KINDS) {
      if (a >= b) continue;
      assert.notEqual(STRUCTURES[a], STRUCTURES[b], `${a} and ${b} share a structure template`);
      assert.notEqual(CHECKLISTS[a], CHECKLISTS[b], `${a} and ${b} share a checklist`);
    }
  }
});

test('structureBlock frames the template as binding, and carries it verbatim', () => {
  // Without the framing sentence the delegate gets an unlabelled wall of markdown.
  const block = structureBlock('data-type');
  assert.match(block, /Follow this data-type structure template and its drafting rules exactly:/);
  assert.ok(block.includes(STRUCTURES['data-type']), 'the template must be included unmodified');
});

test('styleBlock carries the numbered rules verbatim', () => {
  const block = styleBlock();
  assert.match(block, /Writing-style rules/);
  assert.ok(block.includes(STYLE_RULES), 'the rules must be included unmodified');
});

test('the designer render delivers the kind of the current run', () => {
  // The wiring assertion: the role reads docKind() itself, so switching the run's kind must switch
  // the template with no change at any call site.
  withKind('data-type');
  const forDataType = Designer();
  assert.ok(forDataType.includes(STRUCTURES['data-type']));
  assert.equal(forDataType.includes(STRUCTURES.module), false);

  withKind('module');
  const forModule = Designer();
  assert.ok(forModule.includes(STRUCTURES.module));
  assert.equal(forModule.includes(STRUCTURES['data-type']), false);
});

test('the designer render keeps its own instructions', () => {
  // Concatenation, not replacement: the role's .md still has to arrive.
  withKind('tutorial');
  assert.match(Designer(), /You turn research findings into a validated plan/);
});

test('a role render refuses to guess the kind before classification', () => {
  // docKind() throws rather than defaulting, and that guard has to survive the move: a role that
  // defaulted would plan a data type page against the tutorial template and look merely wrong.
  setRunContext({ projectPath: '/tmp', request: 'document something', kind: null, skipPhases: [] });
  assert.throws(() => Designer(), /kind/i);
});
