// Invariants of the KINDS table. Pure data assertions — no Flue runtime, no model calls, so they
// run in milliseconds via `npm test`.
//
// Worth having because the merge moved three files' worth of wiring into one table: a mistake here
// is now a mistake in every kind of document, and most of it fails at runtime rather than at `tsc`
// (a mistyped label breaks log archiving silently; a duplicate tool throws only when the agent
// renders).
import assert from 'node:assert/strict';
import test from 'node:test';

import { DOC_KINDS, KINDS } from './agent.ts';
import { RUN_LABEL as REDUNDANCY_LABEL } from './redundancy.ts';

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
  // Not a KINDS row: the redundancy editor is its own agent, not a kind of document. Asserted in the
  // same place because it is archived by the same script, and fails the same silent way.
  assert.equal(REDUNDANCY_LABEL, 'reduce-redundancy');
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

test('review_page and fact_check_page are the only harness tools any kind mounts', () => {
  // Replaces a test that guarded "a required field no component can produce": a write phase was mounted
  // without the design phase that fed its required `plan`, so the model satisfied the schema by inventing
  // one, and once reached for another type's. That defect needs a tool ARGUMENT to fabricate, and the
  // tools that took one are gone — the test had become vacuous, looping over an empty list.
  //
  // What is worth pinning instead is the shape that replaced it. Every stage is a `task` delegation now,
  // and the harness tools are the exceptions: both hold a delegate's result in TypeScript because
  // `recordedVerdict()` derives the run's verdict from them, and a `task` delegation returns prose that
  // nothing can check.
  //
  // fact_check_page joined review_page deliberately — it gates the verdict on whether the page's claims
  // survive contact with the source. A THIRD arriving is either a mistake or a decision that belongs in
  // a plan, and either way it should not arrive quietly, which is what this list is for.
  for (const kind of DOC_KINDS) {
    assert.deepEqual(
      KINDS[kind].tools.map((tool) => tool.name),
      ['review_page', 'fact_check_page'],
      `${kind} should mount review_page and fact_check_page, and nothing else`,
    );
  }
});

test('check_method_coverage is a plain tool, never a guarded one', () => {
  // The distinction is load-bearing. Everything in `tools` is wrapped by guardPhase, which refuses a
  // call made from inside another phase — correct for phase tools, wrong for this one: it starts no
  // conversation, and the review phase and drafter both have legitimate reason to call it while a
  // phase is open. Listing it under `tools` would refuse it exactly when it is useful.
  for (const kind of DOC_KINDS) {
    const config = KINDS[kind];
    assert.ok(
      !config.tools.some((t) => t.name === 'check_method_coverage'),
      `${kind} must not register check_method_coverage as a phase tool`,
    );
  }

  // Reference pages promise complete API coverage, so both reference kinds get it. A tutorial is
  // selective by design — coverage is not a defect there, and offering the tool would invite a
  // check that should fail.
  for (const kind of ['data-type', 'module'] as const) {
    assert.deepEqual(
      KINDS[kind].plainTools.map((t) => t.name),
      ['check_method_coverage'],
      kind,
    );
  }
  // Empty, not absent. Every row carries every field now, so this asserts what the agent offers
  // rather than which keys the literal happens to spell — the previous `!('plainTools' in …)` passed
  // for a reason the model never sees.
  assert.deepEqual(KINDS.tutorial.plainTools, [], 'tutorial should not offer method coverage');
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
