// Invariants of the KINDS table. Pure data assertions — no Flue runtime, no model calls, so they
// run in milliseconds via `npm test`.
//
// Worth having because the merge moved three files' worth of wiring into one table: a mistake here
// is now a mistake in every kind of document, and most of it fails at runtime rather than at `tsc`
// (a mistyped label breaks log archiving silently; a duplicate tool throws only when the agent
// renders).
import assert from 'node:assert/strict';
import test from 'node:test';
import * as v from 'valibot';

import { DOC_KINDS, KINDS } from './agent.ts';

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

test('only the module kind is still on phase tools', () => {
  // The architecture split, pinned so neither half drifts silently.
  //
  // data-type and tutorial reach their roles with `task` and mount review_page alone. Module reverted
  // after write-module-ref-turn3 reversed its own layout decision mid-run on a rule it invented, which
  // requireModulePlan had previously made impossible — so module mounts the full set again.
  //
  // A tool appearing in data-type or tutorial means the conversion is being undone by accident. A tool
  // DISAPPEARING from module means the pin is gone again, which is the regression that caused the
  // revert. Both should be deliberate, and neither should arrive quietly.
  for (const kind of ['data-type', 'tutorial'] as const) {
    assert.deepEqual(
      KINDS[kind].tools.map((tool) => tool.name),
      ['review_page'],
      `${kind} is converted and should mount review_page alone`,
    );
  }

  const moduleTools = KINDS.module.tools.map((tool) => tool.name);
  for (const required of ['design_module_plan', 'write_module_overview', 'review_page']) {
    assert.ok(moduleTools.includes(required), `module must keep ${required} — see the KINDS comment`);
  }
});

test('a mounted write tool has its plan producer, or its plan is optional', () => {
  // Restored with the module tools it guards. KINDS.module once mounted write_data_type_reference
  // without design_data_type_plan while `plan` was required, so the model — unable to call anything that
  // produces one — satisfied the schema by inventing a plan, and once in fifteen calls reached for
  // another type's: turn3 handed the drafter Lens's research with Iso's plan, naming four methods Lens
  // does not have.
  //
  // Either the producer is mounted alongside its consumer, or the consumer accepts the value's absence.
  // Nothing in between is safe, because the model's way out of "required but unproducible" is fabrication
  // rather than an error.
  const PLAN_PRODUCER: Record<string, string> = {
    write_data_type_reference: 'design_data_type_plan',
    write_module_overview: 'design_module_plan',
    write_tutorial_draft: 'design_tutorial_plan',
  };

  for (const kind of DOC_KINDS) {
    const mounted = KINDS[kind].tools.map((tool) => tool.name);
    for (const tool of KINDS[kind].tools) {
      const producer = PLAN_PRODUCER[tool.name];
      if (!producer || mounted.includes(producer)) continue;

      const entries = (tool.input as { entries?: Record<string, v.GenericSchema> }).entries;
      const plan = entries?.plan;
      assert.ok(plan, `${kind}: ${tool.name} takes no plan field — update PLAN_PRODUCER`);
      // Semantic rather than structural: asks valibot whether absence parses, so v.optional, v.nullish
      // and any future wrapper all answer correctly.
      assert.ok(
        v.safeParse(plan, undefined).success,
        `${kind} mounts ${tool.name} without ${producer}, and its plan is required — the model ` +
          `can only satisfy that by inventing one. Mount ${producer}, or make plan optional.`,
      );
    }
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
