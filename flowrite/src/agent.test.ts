// Invariants of the KINDS table. Pure data assertions — no Flue runtime, no model calls, so they
// run in milliseconds via `npm test`.
//
// Worth having because the merge moved three files' worth of wiring into one table: a mistake here
// is now a mistake in every kind of document, and most of it fails at runtime rather than at `tsc`
// (a mistyped label breaks log archiving silently; a duplicate tool throws only when the agent
// renders).
//
// What tsc DOES cover, measured while adding the fourth kind: a missing KINDS row fails here and in
// agent.ts, because `KINDS[kind]` indexes with a DocKind. So the row cannot be forgotten — only
// filled in wrong.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { DOC_KINDS, type DocKind, GATE_INSTRUCTIONS, KINDS } from './agent.ts';
import { RUN_LABEL as CROSSREF_LABEL } from './crossref.ts';
import { RUN_LABEL as METADATA_LABEL } from './metadata.ts';
import { RUN_LABEL as ORGANIZE_LABEL } from './organize.ts';
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
  assert.equal(KINDS['how-to'].label, 'write-how-to-guide');
  // Not KINDS rows: the standalone agents are their own entry points, not kinds of document.
  // Asserted in the same place because they are archived by the same script, and fail the same
  // silent way.
  assert.equal(REDUNDANCY_LABEL, 'reduce-redundancy');
  assert.equal(METADATA_LABEL, 'backfill-metadata');
  assert.equal(CROSSREF_LABEL, 'cross-link-page');
  assert.equal(ORGANIZE_LABEL, 'organize-reference-docs');
});

test('each fixture launcher passes its own kind label to archive-docs.sh', () => {
  // The test above pins the label strings; this one pins the other end of the same contract. The
  // launcher hands the label to archive-docs.sh, which greps the log for `<label> token
  // consumption:` — so a launcher carrying the wrong label produces an archive with every artifact
  // missing and a summary that reads like a clean run.
  //
  // Reading the scripts because the existing pin asserted string equality against nothing: its own
  // name says "what archive-docs.sh greps for" while no script was ever opened.
  const launchers: Record<DocKind, string> = {
    'data-type': 'run-data-type-ref.sh',
    module: 'run-module-ref.sh',
    tutorial: 'run-tutorial.sh',
    'how-to': 'run-how-to-guide.sh',
  };
  for (const kind of DOC_KINDS) {
    const path = new URL(`../fixtures/tinyproject/scripts/${launchers[kind]}`, import.meta.url);
    const script = readFileSync(path, 'utf8');
    assert.ok(
      script.includes(`archive-docs.sh "$log" ${KINDS[kind].label}`),
      `${launchers[kind]} does not archive under ${KINDS[kind].label}`,
    );
  }
});

test('the gate names every kind of document', () => {
  // The classification prose is hand-written and enumerates the kinds itself — nothing derives it
  // from DOC_KINDS, and nothing type-checks it. So a fifth kind could be wired up, pass tsc, pass
  // every other test here, and never be offered to the model that has to choose it.
  //
  // Presence only. That the discriminator between two kinds is any GOOD is not something a test can
  // reach; it is what the live classification check is for.
  for (const kind of DOC_KINDS) {
    assert.ok(
      GATE_INSTRUCTIONS.includes(`\`${kind}\``),
      `the gate instructions never mention \`${kind}\`, so the model cannot choose it`,
    );
  }
});

test('every mounted skill has a real name', () => {
  // A SKILL.md whose frontmatter is missing `name:` loads as `name: undefined` rather than throwing,
  // and then "no kind mounts the same skill twice" below compares undefined to undefined and passes.
  // Two nameless skills on one row would satisfy every other assertion in this file.
  for (const kind of DOC_KINDS) {
    for (const skill of KINDS[kind].skills) {
      assert.equal(typeof skill.name, 'string', `${kind} mounts a skill with no name`);
      assert.ok((skill.name as string).length > 0, `${kind} mounts a skill with an empty name`);
    }
  }
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

  // Reference pages promise complete API coverage, so both reference kinds get it. A tutorial and a
  // how-to guide are selective by design — coverage is not a defect there, and offering the tool
  // would invite a check that should fail. A how-to is the sharper case of the two: it documents
  // real API, just only the API its one task needs.
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
  for (const kind of ['tutorial', 'how-to'] as const) {
    assert.deepEqual(KINDS[kind].plainTools, [], `${kind} should not offer method coverage`);
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
