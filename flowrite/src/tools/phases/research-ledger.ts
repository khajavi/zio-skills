import type * as v from 'valibot';
import type { dataTypeResearchSchema } from './research.ts';

type DataTypeResearch = v.InferOutput<typeof dataTypeResearchSchema>;

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

/** Reset the ledger. Tests only — module state with no other seam. */
export function __resetResearchLedgerForTests(): void {
  ledger.clear();
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
