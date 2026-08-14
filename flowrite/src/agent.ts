'use agent';
import { useDelivery, usePersistentState, useTool } from '@flue/runtime';
import * as v from 'valibot';

// instructions — one per kind. These files are the real per-kind content and are unchanged by the
// merge: what differs between the three documents is writing guidance, which is data, not code.
import dataTypeRefMd from './instructions/data-type-ref.md';
import moduleRefMd from './instructions/module-ref.md';
import tutorialMd from './instructions/tutorial.md';

import {
  type RunFacts,
  docsWriterDurability,
  docsWriterFields,
  useDocsWriter,
  useRunBasics,
} from './runtime/composition.ts';
import { installVerboseObserver } from './runtime/verbose-observer.ts';

// skills — mdoc-conventions is shared by all three; writing-style comes from the shared baseline.
import mdocConventions from './skills/mdoc-conventions/SKILL.md';
import dataTypeStructure from './skills/data-type-ref-structure/SKILL.md';
import dataTypeChecklist from './skills/data-type-ref-checklist/SKILL.md';
import moduleRefStructure from './skills/module-ref-structure/SKILL.md';
import moduleRefChecklist from './skills/module-ref-checklist/SKILL.md';
import tutorialStructure from './skills/tutorial-structure/SKILL.md';
import tutorialChecklist from './skills/tutorial-checklist/SKILL.md';
// Conditional bulk, activated only by the runs that need it: the sbt examples build when a page embeds
// files, the per-type subpage loop when a module comes out hierarchical. Both would be dead weight in
// an instruction file that rides on every turn.
import companionExamples from './skills/companion-examples/SKILL.md';
// module-subpages is deliberately not imported: the module kind is back on phase tools, and
// module-ref.md spells its per-type loop out inline again — mounting the skill too would deliver the
// same rules twice, which is the waste 600f48a removed. The file stays for when module is retried.

// Phase tools. `data-type` and `tutorial` mount only `review_page` — their other phases are `task`
// delegations now, since each wrapped a delegation in a `harness: true` scratch conversation that never
// resets (agent-api.md:402) and so paid two relay turns to reach a role reachable directly with the
// built-in `task` tool (guide/subagents.md:40,46).
//
// `module` mounts the full set again. Its conversion regressed in a way the others did not — see the
// KINDS row — and the tools it needs back are exactly the ones that pinned the design plan.
//
// review_page is common to all three, because TypeScript has to hold the reviewer's result for
// recordedVerdict(); a `task` delegation returns prose that nothing can check.
import { researchModule, researchDataType } from './tools/phases/research.ts';
import { designModulePlan } from './tools/phases/design-doc-plan.ts';
import { writeModuleOverview, writeDataTypeReference } from './tools/phases/write-doc.ts';
import { writeCompanionExamples } from './tools/phases/write-companion-examples.ts';
import { integrateModuleReference } from './tools/phases/integrate.ts';
import { reviewPage } from './tools/phases/review-page.ts';

// Ordinary tools, mounted unguarded. Deterministic and free, so the writer can iterate against them
// instead of waiting for the review phase to discover a gap.
import { checkMethodCoverage } from './tools/check-method-coverage.ts';

// FLUE_VERBOSE_TOOLS=1 opts into full tool/delegation/turn detail. Installed once, here, because
// this module is now the single entry point for every kind of document.
installVerboseObserver();

// Defined in run-context.ts, where the phase tools can reach the type without importing this module
// and closing a cycle. Re-exported because this is where a reader looks for it, and the tests import
// it from here.
import { DOC_KINDS, type DocKind } from './runtime/run-context.ts';
export { DOC_KINDS, type DocKind };

/**
 * The slice of creation data a run directive may read: the module escape hatches, and nothing else.
 *
 * Narrower than `RunFacts` on purpose — a directive has no business seeing `projectPath` (the
 * sandbox owns that) or `skipPhases` (the phase tools gate on it), and narrowing keeps the table's
 * three directives honest about what they depend on.
 */
export type DirectiveFacts = Pick<RunFacts, 'layout' | 'shapeOverride'>;

/**
 * Everything that differs between the three kinds of document, in one table.
 *
 * There used to be three agents — data-type-ref-writer.ts, module-ref-writer.ts,
 * tutorial-writer.ts — at 64, 87 and 61 lines, structurally identical: same imports, same
 * installVerboseObserver(), same useDocsWriter call, same durability. Only these five fields
 * differed, so they are now five fields rather than three files. The shape was inherited from
 * beta.9, where each kind was a `defineWorkflow` and a workflow was the unit of invocation; Flue 2
 * deleted workflows and the migration mapped one workflow to one agent mechanically.
 *
 * Adding a fourth kind is one row plus its .md, skills and phase tools — no change to the agent
 * function and no new entry point.
 */
export const KINDS = {
  'data-type': {
    label: 'write-data-type-ref',
    instructions: dataTypeRefMd,
    skills: [mdocConventions, dataTypeStructure, dataTypeChecklist, companionExamples],
    tools: [reviewPage],
    plainTools: [checkMethodCoverage],
    directive: (subject: string, _facts: DirectiveFacts) =>
      `Write a complete, compile-verified data type reference page for: ${subject}. ` +
      `Run the full flow (research → design → write → examples → mdoc verify → integrate → ` +
      `review; review covers method coverage + writing style + the checklist).`,
  },
  module: {
    label: 'write-module-ref',
    instructions: moduleRefMd,
    // The ONLY kind still on phase tools, reverted after write-module-ref-turn3.
    //
    // That run reversed its own layout decision mid-flight: the designer chose hierarchical, and the
    // writer then announced that "the auto-rule requires flat layout for modules with only 2 core
    // types" — a rule that appears nowhere in module-ref-structure or module-ref.md, which map layout
    // from SHAPE and carry no type-count threshold at all. It shipped hierarchical anyway while its
    // retrospective claimed twice that it had converted to flat.
    //
    // `requireModulePlan` and `planShape` are what made that impossible: the write phase read the
    // layout from the plan the designer actually returned, so the model could neither invent a rule nor
    // quietly act on one. I described them in the conversion plan as relay comparators, which was half
    // right — one of them was also pinning a DECISION, and nothing in the skills-only shape does.
    //
    // data-type and tutorial stay converted. Module alone regressed, so module alone reverts.
    skills: [mdocConventions, moduleRefStructure, moduleRefChecklist],
    tools: [
      researchModule,
      designModulePlan,
      writeModuleOverview,
      researchDataType,
      writeDataTypeReference,
      writeCompanionExamples,
      integrateModuleReference,
      reviewPage,
    ],
    // Module references carry per-type subpages, so coverage applies to each of them.
    plainTools: [checkMethodCoverage],
    directive: (subject: string, facts: DirectiveFacts) =>
      `Write a complete, compile-verified module reference for the module: ${subject}. ` +
      (facts.shapeOverride
        ? `Classify this module as the "${facts.shapeOverride}" shape — tell the designer to use it. `
        : '') +
      (facts.layout ? `Use the "${facts.layout}" layout — tell the designer to use it. ` : '') +
      `Run the full flow (research → design → write module page → per-type subpages if ` +
      `hierarchical → examples → mdoc verify → integrate → review; review covers per-type method ` +
      `coverage + writing style + the module checklist).`,
  },
  tutorial: {
    label: 'write-tutorial',
    instructions: tutorialMd,
    skills: [mdocConventions, tutorialStructure, tutorialChecklist, companionExamples],
    tools: [reviewPage],
    // Empty rather than absent: every row carries every field, so the call site reads
    // `config.plainTools` like any other. A missing key made the union type reject the property.
    plainTools: [],
    directive: (subject: string, _facts: DirectiveFacts) =>
      `Write a complete, compile-verified tutorial for: ${subject}. ` +
      `Run the full flow (research → design → write → examples → mdoc verify → integrate → review).`,
  },
} as const;

/**
 * Creation data: only the machine settings a sentence cannot express.
 *
 * The subject and the kind of document now come from the message, so nothing here is required —
 * and the whole object is wrapped in `v.optional(..., {})` because absence would otherwise reject
 * the run outright ("a mismatch — including absence, unless the schema accepts undefined — rejects
 * the creating send", reference/agent-api.md). `flue run … -m "…"` with no --data must work.
 */
const initialData = v.optional(v.object({ ...docsWriterFields }), {});

/**
 * The gate render's instructions: before the kind is known, the only thing to do is establish it.
 *
 * Ambiguity must stop the run rather than resolve it. "Write docs for Chunk" genuinely fits both a
 * reference page and a tutorial, and guessing spends hours of pipeline on the wrong document —
 * the same reason an uncertain module-shape classification halts instead of guessing.
 */
const GATE_INSTRUCTIONS = [
  'You write ZIO library documentation. Before any work starts, establish what the request asks for.',
  '',
  'Read the request and decide two things:',
  '',
  '1. **Which kind of document.**',
  '   - `data-type` — a reference page for ONE type: its full public API, every method.',
  '   - `module` — a reference for a MODULE: how its types work together, plus per-type coverage.',
  '   - `tutorial` — a learning-oriented walkthrough of a task or topic.',
  '2. **The subject** — the type name, the module name, or the tutorial topic, as the request names it.',
  '',
  'Record both with `set_document_kind`. The phase tools for that kind appear immediately after.',
  '',
  'When the request is genuinely ambiguous, call `ask_for_clarification` and stop. "Write docs for ' +
    'Chunk" fits both `data-type` and `tutorial` — that is a question, not a guess.',
].join('\n');

/**
 * Writes ZIO documentation of whichever kind the request asks for: a data type reference page, a
 * module reference, or a tutorial.
 *
 * Run it with a plain request — the kind and subject are read from the message:
 *   flue run src/agent.ts --id dtr-Chunk \
 *     -m "Please write reference documentation for the Chunk data type" \
 *     --data '{"projectPath":"/path/to/checkout"}'
 */
export function DocsWriter() {
  const [kind, setKind] = usePersistentState<DocKind | null>('docKind', null);
  const [subject, setSubject] = usePersistentState<string | null>('subject', null);
  const [storedRequest, setRequest] = usePersistentState<string | null>('request', null);
  const delivery = useDelivery();

  // What the requester asked for. On the classification turn the delivery IS the request; after
  // that the recorded copy wins, because the delivery is a cursor that advances to whatever message
  // the model is currently answering — a later message must not silently redefine the run.
  const request = storedRequest ?? (delivery.kind === 'user' ? delivery.body : '');

  // Setup both branches need: run context, model tier, sandbox. Called in BOTH renders with
  // identical values, because `useSandbox` presence is re-read at every turn boundary — a render
  // that skipped it would detach and re-attach the environment and re-announce the workspace.
  const facts = useRunBasics(initialData, request, kind);

  if (kind === null || subject === null) {
    // Two tools while the kind is unknown, and both are plain rather than `harness: true`: they
    // start no sub-conversation, consume no delegation depth, and can re-enter nothing — so neither
    // needs the phase guard. Neither can run twice either, because recording a kind retires this
    // whole branch.
    //
    // Asking is a named tool rather than "just don't call the other one", and that difference was
    // measured, not assumed:
    //
    //   prose "ask and stop", no tool  → classified "write docs for Prism" as data-type and wrote
    //                                    the whole page (53 turns, $0.38)
    //   prose naming this tool         → halted and asked (1 turn, 3.2k tokens)
    //
    // An instruction whose compliance looks like *inaction* is weak; naming the alternative as a
    // capability makes it a real option. A ✅/❌ example pair was tried alongside and ablated — it
    // changed nothing on its own, so it is not here.
    //
    // Note the model asks in prose and does not actually call this tool. It earns its place as the
    // affordance the instruction can point at; the log line is for the case where it is called.
    useTool({
      name: 'ask_for_clarification',
      description:
        'Ask the requester which kind of document they want, when the request does not say. Use ' +
        'instead of set_document_kind — this ends the run with your question, and nothing is written.',
      input: v.object({
        question: v.pipe(
          v.string(),
          v.minLength(1),
          v.description('The question to put to the requester, naming the kinds that would fit.'),
        ),
      }),
      output: v.object({ asked: v.literal(true) }),
      run({ data }) {
        // Nothing durable to record: the question is the run's outcome. Logged so an unattended run
        // that halted is distinguishable from one that crashed.
        console.error(`[docs-writer] asked for clarification: ${data.question}`);
        return { output: { asked: true } };
      },
    });

    useTool({
      name: 'set_document_kind',
      description:
        'Record which kind of document to write and its subject. Call once, after reading the ' +
        'request. The phase tools for that kind become available immediately afterwards.',
      input: v.object({
        docKind: v.picklist(DOC_KINDS),
        subject: v.pipe(
          v.string(),
          v.minLength(1),
          v.description('The type name, module name, or tutorial topic, as the request names it.'),
        ),
        rationale: v.pipe(
          v.string(),
          v.description('One sentence: why this kind, from the wording of the request.'),
        ),
      }),
      output: v.object({ recorded: v.literal(true) }),
      run({ data }) {
        // This input schema is the only runtime validation these state values get: the type
        // parameter on usePersistentState is compile-time only and parses nothing at runtime.
        setKind(data.docKind);
        setSubject(data.subject);
        setRequest(request);
        return { output: { recorded: true } };
      },
    });

    // Declared here too, after the gate's own tools: the `task` roster is frozen into the system
    // prompt from the FIRST render's snapshot, and every phase tool's harness conversation is seeded
    // with that prompt. A roster declared only after classification is invisible to the code that
    // delegates.
    return GATE_INSTRUCTIONS;
  }

  const config = KINDS[kind];
  return useDocsWriter({
    label: config.label,
    instructions: config.instructions,
    // Spread because `as const` makes these readonly and useDocsWriter takes mutable arrays.
    skills: [...config.skills],
    tools: [...config.tools],
    plainTools: [...config.plainTools],
    runDirective: config.directive(subject, facts),
  });
}

/**
 * The durable identity, pinned rather than inherited from the function name.
 *
 * Without this static, storage is keyed by the identifier `DocsWriter`, so renaming the function
 * orphans every conversation under the old key — which already happened here: run.db still holds
 * `DataTypeRefWriter` and `ModuleRefWriter` streams from before the three writers merged, reachable
 * by no name this code exports. `agentName` is the documented fix (agent-api.md, "Agent statics"):
 * the source name and the storage key move independently from now on.
 *
 * Must be a string literal — build targets derive durable identifiers from it before any user code
 * runs. Setting it now retires the 19 `DocsWriter` streams in the cache database, which costs
 * nothing: no run script passes `--id`, so every run opens a fresh conversation and none of them
 * were ever continued.
 */
DocsWriter.agentName = 'docs-writer';
DocsWriter.initialData = initialData;
DocsWriter.durability = docsWriterDurability;
