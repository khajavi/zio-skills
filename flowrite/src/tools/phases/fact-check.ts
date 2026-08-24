import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { isPhaseSkipped } from '../../runtime/skip-phases.ts';
import { authorHint, maxFactCheckRounds } from '../../runtime/run-context.ts';
import { delegate } from '../../runtime/delegate.ts';
import { note } from '../../runtime/log.ts';

/**
 * The fact-check phase: does the page tell the truth about the code?
 *
 * The review phase asks "is this a good page" — structure, coverage, 28 style rules. Nothing asked
 * "is this page TRUE" until now. Technical accuracy appeared only as a checklist line asking the
 * reviewer to verify signatures against the research file's citations, and BACKLOG finding 5 measures
 * what that is worth: the reviewer synthesises its own item list (46 items one round, 44 the next, 41
 * on a module run), so accuracy was checked as often as it happened to invent an item for it. Two real
 * defects passed review because no item covered them.
 *
 * A `harness: true` tool for the same and only reason `review_page` is one: a `task` delegation
 * returns final text and nothing else (guide/subagents.md), and `defineSubagent` has no output schema,
 * so a drift list can become data TypeScript holds only through `harness.prompt(..., { result })`.
 * That matters because this phase gates the verdict, and this repo's rule — earned over three runs
 * where a model filed `passed` against a failing review — is that a gate reads evidence rather than
 * asking the model how it did.
 */

/**
 * One mismatch between what a page claims and what the source says.
 *
 * Adapted from the `docs-gardener` RFC's findings schema
 * (docs/superpowers/specs/2026-07-16-docs-gardener-design.md), whose Signal 2 is this phase. Kept
 * from it: the both-sides citation requirement, and `kind` as the axis that separates a wrong
 * description from an invented API. Dropped: `fingerprint` and `suggestedAction`, which serve
 * cross-run dedup into a rolling GitHub issue — the part of that RFC this does not build.
 */
const driftItemSchema = v.object({
  kind: v.pipe(
    v.picklist(['contradicted', 'not-in-source', 'stale-citation']),
    v.description(
      'contradicted = the member exists but is described wrongly; not-in-source = the page names ' +
        'something the library does not have; stale-citation = the claim is right, its cited location is not.',
    ),
  ),
  severity: v.pipe(
    v.picklist(['high', 'medium', 'low']),
    v.description(
      'high = code written from the page would not compile or would misbehave; medium = wrong but ' +
        'not code-breaking; low = accurate yet misplaced or misnamed.',
    ),
  ),
  claim: v.pipe(v.string(), v.description('The sentence or signature from the page, quoted verbatim')),
  documented: v.pipe(v.string(), v.description('Where the claim sits, as the page path and line')),
  source: v.pipe(
    v.string(),
    v.description('What the source actually says, as path:L<start>-L<end> in a file you opened'),
  ),
  detail: v.pipe(v.string(), v.description('One line: what the page says versus what the source says')),
  fix: v.pipe(v.string(), v.description('The concrete edit that would resolve it')),
});

/**
 * What one fact-check round returns.
 *
 * `incomplete` is the "fail safe, not silent" channel the RFC asks for: a check that could not look
 * must not be indistinguishable from a check that found nothing. It is nullable rather than absent
 * so the model has to answer the question either way.
 */
export const driftSchema = v.object({
  clean: v.pipe(
    v.boolean(),
    v.description('true only when no drift was found AND every section was checked'),
  ),
  sectionsChecked: v.array(v.string()),
  drifts: v.array(driftItemSchema),
  incomplete: v.nullable(
    v.pipe(
      v.string(),
      v.description(
        'Non-null when the check could not complete — a source root that does not exist, a file ' +
          'that would not read. Never report a clean page because you could not look.',
      ),
    ),
  ),
});

export type Drift = v.InferOutput<typeof driftItemSchema>;
export type DriftReport = v.InferOutput<typeof driftSchema>;

const FACT_CHECK_TOOL_NAME = 'fact_check_page';

/**
 * Rounds spent against the budget.
 *
 * Module state, like the review phase's counters and for the same reason: one OS process per run
 * (each `run-*.sh` execs a fresh node), and a run documents one page.
 */
let roundsUsed = 0;

/**
 * Confirming rounds granted so far, and the ceiling on them.
 *
 * Counted rather than a boolean, mirroring the review phase after the same defect was measured there:
 * a round that reports drifts the round before it never mentioned confirmed nothing — it found more
 * work — so the run earns another. A single grant froze the verdict on findings the run then repaired.
 * The cap is what stops the renewal from looping on a page that cannot be fixed.
 */
let confirmingRounds = 0;
const MAX_CONFIRMING_ROUNDS = 3;

/**
 * The finding keys of the check BEFORE `lastOutcome`, so `consumeFactCheckRound` can tell a
 * confirmation from a fresh finding. `null` until a second check lands.
 */
let previousFindingKeys: string[] | null = null;

let budgetRefusals = 0;

/** Refused rounds, by tool name, for the run report. */
export function factCheckRefusals(): Record<string, number> {
  return budgetRefusals > 0 ? { [FACT_CHECK_TOOL_NAME]: budgetRefusals } : {};
}

/** Reset the round counters. Tests only — module state with no other seam. */
export function __resetFactCheckRoundsForTests(): void {
  roundsUsed = 0;
  confirmingRounds = 0;
  previousFindingKeys = null;
  budgetRefusals = 0;
}

/**
 * What the last fact-check of this run concluded.
 *
 * Recorded for the same reason the review phase records its outcome: `recordedVerdict()` derives the
 * run's verdict from it, so it may not be something the model reports at the end. A page whose
 * claims the source contradicts must not be filable as passing, and the only way to guarantee that
 * is for the answer to already be in TypeScript's hands.
 */
type FactCheckOutcome =
  | { state: 'skipped' }
  | { state: 'checked'; drifts: Drift[]; incomplete: string | null };

let lastOutcome: FactCheckOutcome | null = null;

/** Reset the recorded fact-check. Tests only — module state with no other seam. */
export function __resetLastFactCheckForTests(): void {
  lastOutcome = null;
  previousFindingKeys = null;
}

/** Record what a fact-check concluded. Tests only; the phase records on its own path. */
export function __setLastFactCheckForTests(outcome: FactCheckOutcome | null): void {
  recordFactCheck(outcome);
}

/**
 * A drift's identity across rounds: which member, and what kind of problem.
 *
 * Deliberately not the whole finding. `claim` is the page text and changes the moment the drift is
 * fixed; `detail` and `fix` are model-authored prose that varies between rounds; `documented` is a
 * page line number that shifts when anything above it is edited. `source` is the declaration's own
 * location, which is stable while the source is — and the source is what the run is forbidden to
 * touch. So "the same problem, reported again" survives the page being rewritten around it.
 */
function driftKey(drift: Drift): string {
  return `${drift.kind}|${drift.source}`;
}

/** The finding keys in an outcome; empty for a skip or for nothing recorded. */
function findingKeysOf(outcome: FactCheckOutcome | null): string[] {
  if (outcome === null || outcome.state === 'skipped') return [];
  const keys = outcome.drifts.map(driftKey);
  // An incomplete check is a finding too — a round that could not look, then looked, found something
  // new by any reading that matters.
  if (outcome.incomplete !== null) keys.push('incomplete');
  return keys;
}

/**
 * Record a fact-check, keeping the one before it.
 *
 * The previous round's findings are what make "this round confirmed the fixes" distinguishable from
 * "this round found more" — see `consumeFactCheckRound`. Every write to `lastOutcome` goes through
 * here so the two can never drift apart.
 */
function recordFactCheck(outcome: FactCheckOutcome | null): void {
  previousFindingKeys = findingKeysOf(lastOutcome);
  lastOutcome = outcome;
}

/** One drift, as a failing-item line. Prefixed so a flat `failingItems` list stays legible. */
function driftItem(drift: Drift): string {
  return `fact-check (${drift.severity}/${drift.kind}): ${drift.detail} — ${drift.documented} vs ${drift.source}`;
}

/**
 * What the recorded fact-check contributes to the run's verdict.
 *
 * `blocking` is the gate. A `high` or `medium` drift blocks, and so does `incomplete`: "could not
 * look" is not "no drift", and a run that failed to check must not record the page as verified.
 *
 * `low` drifts are named but do not block. Severity is authored by the model and nothing calibrates
 * it yet, so the one class where a false positive is most likely — an accurate claim with a stale
 * citation — is reported without failing the run. Worth revisiting once fixture runs give it
 * evidence.
 *
 * A skipped or never-run fact-check contributes nothing at all, mirroring how a skipped review
 * yields `not-reviewed` rather than a free pass: skipping is a human decision and produces no
 * evidence in either direction.
 */
export function recordedFactCheck(): {
  state: 'none' | 'skipped' | 'checked';
  failingItems: string[];
  blocking: boolean;
} {
  if (lastOutcome === null) return { state: 'none', failingItems: [], blocking: false };
  if (lastOutcome.state === 'skipped') return { state: 'skipped', failingItems: [], blocking: false };

  const failingItems = lastOutcome.drifts.map(driftItem);
  if (lastOutcome.incomplete !== null) {
    failingItems.push(`fact-check could not complete: ${lastOutcome.incomplete}`);
  }
  const blocking =
    lastOutcome.incomplete !== null ||
    lastOutcome.drifts.some((drift) => drift.severity === 'high' || drift.severity === 'medium');

  return { state: 'checked', failingItems, blocking };
}

/**
 * Spend one fact-check round, or refuse.
 *
 * A copy of `consumeReviewRound` in structure and in intent, against its own counters — see
 * `maxFactCheckRounds()` for why the budgets are separate. Thrown before any delegation, so a
 * refused round costs nothing, and the message has to read as an instruction because it is the only
 * prompt the model gets at this point.
 *
 * The confirming round is not garnish. Without it a gate can be failed and never cleared: the
 * verdict is the LAST recorded outcome, a refused call records none, so a run that repaired every
 * drift would still file the pre-fix result. That is measured, on the review side —
 * write-module-ref-turn4 fixed 5 of 6 items, filed all 6, then wrote "production-ready and passes
 * all technical verification" in prose. A gate with no path to prove repair manufactures exactly
 * that.
 */
export function consumeFactCheckRound(): void {
  const budget = maxFactCheckRounds();
  if (roundsUsed < budget) {
    roundsUsed++;
    return;
  }

  // A grant is renewed only when the round that spent the last one reported drifts the round before it
  // never mentioned. That round confirmed nothing — it found more work, and the page it judged is not
  // the page the model went on to fix. A round that merely repeats the previous drifts has confirmed
  // what it can, so the run ends on it rather than paying for a third opinion.
  //
  // Mirrors `consumeReviewRound` after the same defect was measured on two runs there. Not measured
  // here — this phase has never run — but the mechanism is identical, and shipping the two gates with
  // divergent budgets would mean knowingly keeping the bug in one of them.
  const lastFindings = findingKeysOf(lastOutcome);
  // Bound to a local so the null check narrows inside the closure — module state does not.
  const previous = previousFindingKeys;
  const foundNewDrifts = previous !== null && lastFindings.some((key) => !previous.includes(key));
  const renewable = confirmingRounds === 0 || foundNewDrifts;
  if (lastFindings.length > 0 && renewable && confirmingRounds < MAX_CONFIRMING_ROUNDS) {
    confirmingRounds++;
    roundsUsed++;
    return;
  }

  budgetRefusals += 1;
  const spent =
    confirmingRounds === 0
      ? ''
      : ` plus ${confirmingRounds} confirming round${confirmingRounds === 1 ? '' : 's'}`;
  const why =
    confirmingRounds >= MAX_CONFIRMING_ROUNDS
      ? `The confirming rounds are exhausted.`
      : `The last check repeated drifts the one before it already reported, so another round would ` +
        `find the same page.`;
  throw new Error(
    `The fact-check budget for this run is spent (${budget} round${budget === 1 ? '' : 's'}${spent}, ` +
      `all used). ${why} Do not call fact check again. ` +
      `Fix every drift the last check reported, then continue. The verdict comes from the check ` +
      `itself, so it will record what the last one found — name what you fixed and anything still ` +
      `wrong in your summary and your closing reply, and do not describe an unverified page as correct.`,
  );
}

/** A page section: its heading, and the text under it. */
export interface Section {
  heading: string;
  body: string;
}

/**
 * The label for text that precedes the first `##` heading.
 *
 * Not a throwaway: a reference page opens with its definition and the type's headline signature
 * BEFORE any heading (data-type-ref-structure/references/structure.md), so dropping the preamble
 * would leave the single most load-bearing signature on the page unchecked.
 */
export const PREAMBLE = '(opening, before the first heading)';

/**
 * Split a page into `##` sections, keeping every line.
 *
 * `##` only. `###` and `####` are the per-capability subsections inside Core Operations, and
 * splitting on them would cut a method's prose away from the signature block it describes — which is
 * precisely the pair a checker has to see together.
 */
export function splitSections(content: string): Section[] {
  const sections: Section[] = [];
  let heading = PREAMBLE;
  let body: string[] = [];

  const flush = () => {
    if (body.join('\n').trim().length > 0) sections.push({ heading, body: body.join('\n') });
  };

  for (const line of content.split('\n')) {
    // `## ` exactly: a `###` subsection stays with its parent, and a `#` title is page-level.
    if (/^## (?!#)/.test(line)) {
      flush();
      heading = line.replace(/^##\s*/, '').trim();
      body = [line];
      continue;
    }
    body.push(line);
  }
  flush();

  return sections;
}

/**
 * How much page text one delegation may carry, and how many delegations one round may spend.
 *
 * Both bound the same thing from opposite ends. A whole reference page plus the source it cites
 * crowds one context window — the "long module run degrades" effect CLAUDE.md names — so sections are
 * chunked to keep each delegate's window mostly source. But one delegation per section would put a
 * dozen serial model calls in one phase, so consecutive sections share a chunk until the budget is
 * used.
 *
 * Serial, not parallel, and this is a constraint rather than a choice: a harness session runs one
 * operation at a time and rejects a concurrent one with `SessionBusyError` ("Sessions run one
 * operation at a time; open another session for parallel branches", reference/errors.md). The
 * parallelism the runtime does offer is the MODEL batching `task` calls, which a harness tool cannot
 * reach. So the chunk budget is a wall-clock budget too.
 */
const MAX_CHUNK_CHARS = 8_000;
const MAX_CHUNKS = 8;

/** Group consecutive sections into chunks no larger than `maxChars`. A single oversized section stands alone. */
export function chunkSections(sections: Section[], maxChars = MAX_CHUNK_CHARS): Section[][] {
  const chunks: Section[][] = [];
  let current: Section[] = [];
  let size = 0;

  for (const section of sections) {
    // A section bigger than the budget cannot be split further without cutting prose from the
    // signature it describes, so it takes a chunk of its own and the delegate gets a fuller window.
    if (current.length > 0 && size + section.body.length > maxChars) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(section);
    size += section.body.length;
  }
  if (current.length > 0) chunks.push(current);

  return chunks;
}

/** Merge the per-chunk reports into the one report the tool returns. */
export function mergeReports(reports: DriftReport[], skipped: string[]): DriftReport {
  const incompletes = reports.map((report) => report.incomplete).filter((reason): reason is string => reason !== null);
  if (skipped.length > 0) {
    incompletes.push(
      `${skipped.length} section(s) were not checked because the per-round chunk budget ran out: ${skipped.join(', ')}`,
    );
  }

  const drifts = reports.flatMap((report) => report.drifts);
  const incomplete = incompletes.length > 0 ? incompletes.join('; ') : null;

  return {
    // Not `every(r => r.clean)`: a chunk could report clean while another could not look, and the
    // page as a whole is then neither clean nor checked.
    clean: drifts.length === 0 && incomplete === null,
    sectionsChecked: reports.flatMap((report) => report.sectionsChecked),
    drifts,
    incomplete,
  };
}

/** The prompt for one chunk. A delegate sees nothing of this conversation, so it must be a whole briefing. */
function chunkPrompt(pagePath: string, chunk: Section[]): string {
  return [
    `Fact-check the documentation below against the library's real source.`,
    ``,
    `The page is \`${pagePath}\`, in the checkout your shell already starts in. It documents this`,
    `request:`,
    authorHint().trim() || `(the request was not recorded — take the subject from the page itself)`,
    ``,
    `Find the sources yourself under the checkout's \`*/src/main/scala*/\` trees — that is the`,
    `authority for every claim below. A research file may exist under \`.flowrite/research/\`; use it`,
    `to locate things faster, never as authority.`,
    ``,
    `Check these section(s), and report every claim the source contradicts. Set`,
    `sectionsChecked to exactly these headings:`,
    ...chunk.map((section) => `  - ${section.heading}`),
    ``,
    `--- SECTIONS OF ${pagePath} ---`,
    ...chunk.map((section) => section.body),
  ].join('\n');
}

/**
 * Check the page at `path` against the sources it describes.
 *
 * One tool for all three kinds, like `review_page`: every kind takes `{ path }` and returns
 * `driftSchema`, and nothing here varies by document kind — a tutorial's claim about a return type is
 * checked exactly like a reference page's.
 */
export const factCheckPage = defineTool({
  name: FACT_CHECK_TOOL_NAME,
  description:
    'Check every factual claim on the finished page against the library source, and report each ' +
    'mismatch with citations to both sides. Fix what it reports yourself. Drifts fail the run, so ' +
    'a page that survives this is one the source actually supports. ' +
    'This run allows ONE fact-check round; if it reports drifts, fix them all and call it ONCE more — ' +
    'that confirming round is what lets the run record the page as correct, since the recorded ' +
    'result is whatever the last check found. If that round reports NEW drifts instead of confirming ' +
    'your fixes, fix those too and call it again: a round that found something new earns another. ' +
    'Rounds run out once a check only repeats what the previous one said. A check that reported ' +
    'nothing needs no confirmation.',
  harness: true,
  input: v.object({
    path: v.pipe(
      v.string(),
      v.description(
        'The page to check, repo-relative — e.g. docs/reference/prism.md, docs/guides/scope.md, or a ' +
          "module reference's flat page or hierarchical index.",
      ),
    ),
  }),
  output: driftSchema,
  async run({ harness, data, log }) {
    if (isPhaseSkipped('fact-check')) {
      // Recorded as skipped, never as clean. The returned report keeps the chain wired for the model,
      // but it is not evidence, so `recordedFactCheck()` reports `skipped` and gates nothing.
      recordFactCheck({ state: 'skipped' });
      return {
        output: {
          clean: true,
          sectionsChecked: [],
          drifts: [],
          incomplete: 'Skipped by request.',
        },
      };
    }

    // Before the file read and any delegation: a refused round must cost nothing.
    consumeFactCheckRound();

    const content = await harness.sandbox.readFile(data.path);
    const sections = splitSections(content);
    const chunks = chunkSections(sections);
    const checked = chunks.slice(0, MAX_CHUNKS);
    const skipped = chunks.slice(MAX_CHUNKS).flatMap((chunk) => chunk.map((section) => section.heading));

    note(
      log,
      `Fact-checking ${data.path} against source: ${sections.length} section(s) in ${checked.length} delegation(s)`,
    );

    const reports: DriftReport[] = [];
    for (const chunk of checked) {
      // Serial by necessity, not by preference — see MAX_CHUNKS: a harness session runs one
      // operation at a time and rejects a concurrent one with SessionBusyError.
      reports.push(
        await delegate({
          harness,
          log,
          label: `fact_checker (${chunk[0]?.heading ?? PREAMBLE})`,
          role: 'fact_checker',
          result: driftSchema,
          prompt: chunkPrompt(data.path, chunk),
        }),
      );
    }

    const report = mergeReports(reports, skipped);

    // Recorded on the path that actually runs, in one place. The review phase carries a comment about
    // an earlier phase that recorded only in its skip branch, so a successful run recorded nothing and
    // the next phase refused work that had in fact been done.
    recordFactCheck({ state: 'checked', drifts: report.drifts, incomplete: report.incomplete });

    const blocking = report.drifts.filter((drift) => drift.severity !== 'low').length;
    note(
      log,
      `Fact-check of ${data.path}: ${report.drifts.length} drift(s), ${blocking} of them gating` +
        `${report.incomplete === null ? '' : ` — incomplete: ${report.incomplete}`}`,
    );

    return { output: report };
  },
});
