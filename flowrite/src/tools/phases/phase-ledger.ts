import type * as v from 'valibot';
import type { dataTypeResearchSchema } from './research.ts';
import type { modulePlanSchema } from './design-doc-plan.ts';

type DataTypeResearch = v.InferOutput<typeof dataTypeResearchSchema>;
type ModulePlan = v.InferOutput<typeof modulePlanSchema>;

/**
 * What `research_data_type` actually returned this run, keyed by type name.
 *
 * The write phase reads its research from here rather than from the payload the model relays, because
 * a model that cannot get a value will produce one. Measured on `write-module-ref-turn5`: four subpage
 * research calls fired concurrently, Iso's researcher returned no structured answer and called
 * `give_up`, so `research_data_type` ended `isError=true` after 141s — and the model then supplied a
 * complete `dataTypeResearchSchema` payload for Iso out of its own context. Six operations with
 * signatures, `sourceFiles`, `groundingDetail` prose, and per-method line citations that were uniformly
 * off by one (claimed L22/25/28/31/34; the real Iso.scala has 23/26/29/32/35). The page came out
 * correct because the model's recall was good and line numbers never reach a page, so mdoc, the
 * checklist and the reviewer all passed it.
 *
 * That is the same defect class as the fabricated plan (see write-doc.ts's `plan` field), but worse:
 * there the producer was never mounted, here the producer exists and failed. Failure is surfaced to
 * the model as a tool error, which it is free to work around — and working around it means inventing
 * the facts a reference page is supposed to be grounded in.
 *
 * Module state, like every other per-run counter here: one OS process per run, and a run documents one
 * page or one module. It would need a per-run key to serve concurrent runs in one process.
 */
const ledger = new Map<string, DataTypeResearch>();

/** Type names differ in case and spacing between the research call and the write call; keys must not. */
const key = (typeName: string): string => typeName.trim().toLowerCase();

/** Record the research a successful `research_data_type` call produced. */
export function recordResearch(research: DataTypeResearch): void {
  ledger.set(key(research.typeName), research);
}

/**
 * The recorded research for a type, or a refusal.
 *
 * Thrown rather than returned, and the message is the only prompt the model gets at this point — so it
 * has to say what to do next. The same mechanism `consumeReviewRound` and `phase-guard.ts` rely on.
 */
export function requireResearch(typeName: string): DataTypeResearch {
  const recorded = ledger.get(key(typeName));
  if (!recorded) {
    throw new Error(
      `No successful research is on record for "${typeName}", so there is nothing to write this page ` +
        `from. Call research_data_type with typeName "${typeName}" and let it return, then write the ` +
        `page. If research_data_type already failed for this type, call it again rather than supplying ` +
        `researchAnswers yourself: a page built from remembered facts cites line numbers and ` +
        `signatures that were never read, and nothing downstream can tell the difference.`,
    );
  }
  return recorded;
}

/** Reset every record. Tests only — module state with no other seam. */
export function __resetPhaseLedgerForTests(): void {
  ledger.clear();
  modulePlans.clear();
}

/**
 * The operation names in a payload, for comparing what the model relayed against what was recorded.
 *
 * A set rather than a deep equality check on purpose: the model reserializes the payload on its way
 * through the conversation, so array order and formatting drift for reasons that mean nothing. A
 * differing set of operation names does mean something — it is the shape of the turn5 fabrication.
 */
export const operationNames = (research: DataTypeResearch): string[] =>
  [...new Set(research.coreOperations.map((op) => op.name))].sort();

/**
 * The plan `design_module_plan` actually returned, keyed by module name.
 *
 * Same rule as the research above, on the field that decides the most: a module plan carries `shape`,
 * `layout` and `typeGroups`, so it determines which subpages exist, how they group, and what the index
 * page says. A subpage plan mis-shapes one page; this one mis-shapes the whole reference, starting with
 * the page a reader lands on first.
 *
 * Measured on `write-module-ref-turn7`: the model issued `write_module_overview` and
 * `design_module_plan` in the SAME turn — write started at log line 58, design finished at line 709,
 * 147 seconds later — and filled `write_module_overview.plan` itself in the meantime. Its own thinking
 * mentioned only `design_module_plan`, so this was not deliberate reordering; the field was required, so
 * it was filled. `write-module-ref-turn9` got the order right, which makes it intermittent rather than
 * fixed: the profile that survives review and ships.
 *
 * Not covered by the phase memo in phase-guard.ts, deliberately — `write_*` is excluded there because a
 * redraft after review arrives with the same plan and research.
 */
const modulePlans = new Map<string, ModulePlan>();

/** Record the plan a successful `design_module_plan` call produced. */
export function recordModulePlan(moduleName: string, plan: ModulePlan): void {
  modulePlans.set(key(moduleName), plan);
}

/**
 * The recorded plan for a module, or a refusal.
 *
 * The message is the only prompt the model gets here, so it names the next action. A model that has
 * just read the module research can compose a plausible `shape`/`layout`/`typeGroups` — that is exactly
 * what turn7 did — so telling it to wait for the design phase has to be explicit.
 */
export function requireModulePlan(moduleName: string): ModulePlan {
  const recorded = modulePlans.get(key(moduleName));
  if (!recorded) {
    throw new Error(
      `No designed plan is on record for the "${moduleName}" module, so there is nothing to write the ` +
        `module page from. Call design_module_plan with moduleName "${moduleName}" and WAIT for it to ` +
        `return before writing — do not compose the plan yourself. The plan decides the layout, the ` +
        `shape and the type groups, so an invented one mis-shapes every subpage that follows.`,
    );
  }
  return recorded;
}

/**
 * A short summary of a plan's decisions, for comparing what the model relayed against what was designed.
 *
 * The three fields that change the output: the layout picks the file structure, the shape drives the
 * page body, and the group labels decide the subpage roster. Deliberately not a deep comparison — the
 * model reserializes the plan on its way through the conversation, so ordering and formatting drift for
 * reasons that mean nothing.
 */
export const planShape = (plan: ModulePlan): string =>
  `${plan.shape}/${plan.layout}/[${plan.typeGroups.map((g) => g.label).join('|')}]`;
