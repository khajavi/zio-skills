import { type FlueHarness, type FlueLogger, defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { isPhaseSkipped } from '../../runtime/skip-phases.ts';
import { type DocKind, authorHint, docKind, maxReviewRounds } from '../../runtime/run-context.ts';
import { delegate } from '../../runtime/delegate.ts';
import { note } from '../../runtime/log.ts';
// Each kind's checklist and the writing-style rules, injected into the generic reviewer's task.
//
// These stay injected rather than moving to the reviewer's render, unlike the drafter's and designer's
// templates. The reason is the round budget: a run may review more than once, and a second round
// re-reads a page the writer has since fixed. Delivering the checklist through the render would be
// equivalent, but the reviewer is also the one role whose result TypeScript still holds
// (`recordedVerdict()`), so leaving its prompt assembly alone keeps that seam undisturbed while the
// other phases convert. Revisit when review converts.
import { CHECKLISTS, STYLE_RULES } from '../../runtime/kind-docs.ts';

/**
 * The review phase: a simple LLM review.
 *
 * One delegation to the generic `reviewer` role per call — the kind's checklist, the writing-style
 * rules, and the page. The reviewer judges everything; the verdict is whatever it reports.
 *
 * This deliberately replaces a registry of code checks (15 mechanical style graders, a
 * reference-existence check, per-type method coverage, free-first triage, narrowed repeats, a payload
 * guard and a stall guard) — removed by direction on 2026-08-12: checking through code was not wanted,
 * a simple model-based review was. The verdict recorder outlived that removal by a few hours and then
 * went too, so nothing outside this function keeps the result: `report_run_result` takes the model's
 * word for what the review concluded.
 *
 * Known costs of this shape, measured before the registry existed: every call re-judges everything
 * (there is no cheap confirming pass), rules that are arithmetic — table padding, title case, line
 * counting — are judged by a model again, and a run's recorded pass/fail is now self-reported. The
 * first of those is why a run gets a bounded number of rounds — see maxReviewRounds().
 */

/**
 * Per-item pass/fail from a checklist review. `passed` is true only when every item passes.
 *
 * Lives here because the review phase is the only thing that produces or consumes it. It sat in a
 * shared schemas module back when there were three review tools in three files; they are one file
 * now, and `report_run_result` takes the verdict as the model's own claim rather than this shape.
 */
export const reviewSchema = v.object({
  passed: v.pipe(v.boolean(), v.description('true only when every checklist item passes')),
  items: v.array(
    v.object({
      item: v.string(),
      pass: v.boolean(),
      issue: v.nullable(v.pipe(v.string(), v.description('Specific problem when pass is false'))),
    }),
  ),
});

/**
 * The review phase: a simple LLM review.
 *
 * One delegation to the generic `reviewer` role per call — the kind's checklist, the writing-style
 * rules, and the page. The reviewer judges everything; the verdict is whatever it reports.
 *
 * This deliberately replaces a registry of code checks (15 mechanical style graders, a
 * reference-existence check, per-type method coverage, free-first triage, narrowed repeats, a payload
 * guard and a stall guard) — removed by direction on 2026-08-12: checking through code was not wanted,
 * a simple model-based review was. The verdict recorder outlived that removal by a few hours and then
 * went too, so nothing outside this function keeps the result: `report_run_result` takes the model's
 * word for what the review concluded.
 *
 * Known costs of this shape, measured before the registry existed: every call re-judges everything
 * (there is no cheap confirming pass), rules that are arithmetic — table padding, title case, line
 * counting — are judged by a model again, and a run's recorded pass/fail is now self-reported.
 */
/**
 * Review rounds spent this run.
 *
 * Module state, like every other per-run counter here: one OS process per run (each `run-*.sh` execs a
 * fresh node), and a run documents one page. Counted across all three review tools on purpose — a
 * module run reviewing an index and then a subpage is still spending one budget.
 */
let roundsUsed = 0;

/**
 * Whether the one confirming round has been spent.
 *
 * Separate from `roundsUsed` because it is granted on a condition rather than budgeted: see
 * `consumeReviewRound`. One per run, never two, so a review that keeps failing cannot spend rounds
 * forever.
 */
let confirmingUsed = false;

/** Reset the round counters. Tests only — they are module state with no other seam. */
export function __resetReviewRoundsForTests(): void {
  roundsUsed = 0;
  confirmingUsed = false;
}

/**
 * What the last review of this run concluded, so `report_run_result` can state the verdict rather
 * than ask the model for it.
 *
 * This is NOT the check registry removed on 2026-08-12, and reinstates none of it: the `reviewer`
 * role is still the only judge, no code grades the page, and nothing here re-checks anything. It
 * remembers one answer the reviewer already gave.
 *
 * It exists because the alternative was measured and failed. tinytally turn1: the reviewer returned
 * 14 items, every one `pass: false`; the round budget then refused a confirming pass, telling the
 * model in as many words to file `reviewVerdict "failed"` with those items. It filed
 * `{"passed": true, "failingItems": []}` — the inverse — and `verdict.json` recorded that as the
 * run's outcome. Three runs of the same defect are on record now, so the verdict stopped being
 * something to ask for.
 *
 * Module state, like `roundsUsed` above: one OS process per run, one page per run.
 */
type ReviewOutcome =
  | { state: 'skipped' }
  | { state: 'reviewed'; items: v.InferOutput<typeof reviewSchema>['items'] };

let lastOutcome: ReviewOutcome | null = null;

/** Reset the recorded review. Tests only — module state with no other seam. */
export function __resetLastReviewForTests(): void {
  lastOutcome = null;
}

/** Record what a review concluded. Tests only; the phase records on its own path. */
export function __setLastReviewForTests(outcome: ReviewOutcome | null): void {
  lastOutcome = outcome;
}

/**
 * The run's verdict, derived from what the reviewer actually returned.
 *
 * A skipped review counts as `not-reviewed`, not as `passed`: skipping is a human decision to resume
 * a run, and it produces no evidence about the page. Same for a run where the model never called
 * review at all — which is how a page written past a refused phase (#49) stops being filable as
 * passing.
 *
 * "Reviewed, failures found, fixes unverified" reports as `failed`, and that is deliberate: nothing
 * observed the fixed page, and a verdict may not claim more than the evidence. What changed is how a
 * run earns better evidence — `consumeReviewRound` grants one confirming round after a failing review,
 * so a run that repairs everything can be observed doing it. `failed` now means the page was still
 * failing when last looked at, not merely that the budget ran out first.
 */
export function recordedVerdict(): {
  verdict: 'passed' | 'failed' | 'not-reviewed';
  failingItems: string[];
} {
  if (lastOutcome === null || lastOutcome.state === 'skipped') {
    return { verdict: 'not-reviewed', failingItems: [] };
  }
  const failingItems = lastOutcome.items.filter((item) => !item.pass).map((item) => item.item);
  return { verdict: failingItems.length === 0 ? 'passed' : 'failed', failingItems };
}

/**
 * The budget, stated in every review tool's description.
 *
 * Derived from the same function the enforcement uses, so raising `MAX_REVIEW_ROUNDS` changes what the
 * model is told in the same breath as what it is allowed. A description promising a confirming round
 * that the code then refuses is worse than no description: it spends a turn on a tool error.
 */
function reviewBudgetNote(): string {
  const budget = maxReviewRounds();
  const rounds =
    budget === 1 ? 'This run allows ONE review round' : `This run allows ${budget} review rounds`;
  // The confirming round only helps if the model knows to spend it. It is conditional, so say what
  // unlocks it: a review that found nothing has nothing to confirm, and calling again there is refused.
  return (
    `${rounds}. If a review reports failing items, fix them all and then call review ONCE more — that ` +
    `confirming round is what lets the run record the page as passing, since the verdict is whatever ` +
    `the last review found. A review that reported nothing needs no confirmation: finish instead.`
  );
}

/**
 * Spend one review round, or refuse.
 *
 * Thrown rather than returned, and thrown BEFORE any delegation so a refused round costs nothing. The
 * runtime surfaces a thrown error to the calling model as a tool error, which it reads as an
 * instruction — the same mechanism phase-guard.ts relies on. So the message has to say what to do
 * next, because it is the only prompt the model gets at this point.
 */
export function consumeReviewRound(): void {
  const budget = maxReviewRounds();
  if (roundsUsed < budget) {
    roundsUsed++;
    return;
  }

  // The budget is spent. Grant ONE confirming round when the last review found failures, because
  // without it a run that repairs everything can never record that it did: `recordedVerdict()` returns
  // the last outcome, the refused call records none, so the verdict permanently predates the fixes.
  // write-module-ref-turn4 fixed 5 of 6 items and still filed all 6 — then wrote "production-ready and
  // passes all technical verification" in prose, contradicting the verdict it could not change. So the
  // mechanism meant to stop optimistic self-reporting was manufacturing the motive for it.
  //
  // Conditional, not budgeted, and that is the point: a clean first review needs no confirmation and
  // pays nothing, while a failing one buys evidence about the fixed page rather than an assumption.
  // `confirmingUsed` caps it at one — a second failing round ends the run, so a page that cannot be
  // repaired still reports `failed` instead of looping. Worst case is two rounds, and only when the
  // first one found something.
  const lastFailed =
    lastOutcome?.state === 'reviewed' && lastOutcome.items.some((item) => !item.pass);
  if (!confirmingUsed && lastFailed) {
    confirmingUsed = true;
    roundsUsed++;
    return;
  }

  throw new Error(
    `The review budget for this run is spent (${budget} round${budget === 1 ? '' : 's'}` +
      `${confirmingUsed ? ' plus the confirming round' : ''}, all used). Do not call review again. ` +
      `Fix what the last review reported, then file report_run_result. The verdict comes from the ` +
      `review itself, so it will record what the last review found — name what you fixed and anything ` +
      `still wrong in your summary and your closing reply, and do not describe an unverified page as ` +
      `complete.`,
  );
}

// The per-kind checklist table moved to runtime/kind-docs.ts, alongside the structure templates and
// the style rules, so the three-way maps live in one place rather than one per consumer. It briefly
// also carried a `noun` ("data type reference page") and a `label` ("REFERENCE PAGE"); both were
// dropped as pure restatement — each checklist opens by naming its own kind, and the fence below
// already carries the page's path.

/**
 * Review the page at `path` against its kind's checklist and the writing style rules.
 *
 * ONE tool for all three kinds, unlike the research, design and write phases. Those keep a tool per
 * kind because each carries a different result schema that the next phase embeds verbatim; review
 * has neither — every kind takes `{ path }` and returns `reviewSchema`. All that differed was which
 * checklist string got pasted into the prompt, which is data, and the kind now arrives through the
 * run context rather than as a parameter the model could get wrong.
 */
export const reviewPage = defineTool({
  name: 'review_page',
  description:
    'Review the finished page against its document kind\'s checklist and the writing style rules; ' +
    'report per-item pass/fail. Fix the failures yourself. ' +
    reviewBudgetNote(),
  harness: true,
  input: v.object({
    path: v.pipe(
      v.string(),
      v.description(
        'The page to review, repo-relative — e.g. docs/reference/prism.md, docs/guides/scope.md, or a ' +
          'module reference\'s flat page or hierarchical index.',
      ),
    ),
  }),
  output: reviewSchema,
  async run({ harness, data, log }) {
    if (isPhaseSkipped('review')) {
      // Recorded as skipped rather than as a pass: the synthetic item below keeps the chain wired
      // for the model, but it is not evidence, so recordedVerdict() reports "not-reviewed".
      lastOutcome = { state: 'skipped' };
      return {
        output: { passed: true, items: [{ item: 'Review', pass: true, issue: 'Skipped by request.' }] },
      };
    }

    // Before the file read and the delegation: a refused round must cost nothing. A skipped phase
    // does not spend budget, since it never reviewed anything.
    consumeReviewRound();

    const checklistDoc = CHECKLISTS[docKind()];
    const content = await harness.sandbox.readFile(data.path);
    note(log, `Reviewing ${data.path} against the ${docKind()} checklist and the writing style rules`);
    const review = await delegate({
      harness,
      log,
      label: 'reviewer',
      role: 'reviewer',
      result: reviewSchema,
      prompt: [
          `Evaluate the page below against every item in this checklist:`,
          ``,
          checklistDoc,
          ``,
          `Also check it against every one of these writing style rules, reporting each violation as a`,
          `failing item named "writing-style rule <N>" with the line and a specific, actionable issue:`,
          ``,
          STYLE_RULES,
          // Before the content delimiter, so the hint reads as reviewer guidance rather than as part
          // of the page under review.
          authorHint(),
          ``,
        `--- PAGE (${data.path}) ---`,
        content,
      ].join('\n'),
    });

    // Recorded BEFORE returning, on the path that actually runs. design-doc-plan.ts shipped this
    // same recording wired into its skip branch only, so a successful phase recorded nothing and the
    // next phase refused work that had in fact been done (9870589). One place, one path.
    lastOutcome = { state: 'reviewed', items: review.items };

    // The review phase logged nothing at all until now, so `grep 'flowrite:'` showed a run jumping
    // from integrate straight to the closing report (#53). The counts are what a reader wants: how
    // many items the reviewer judged, and how many it failed.
    const failed = review.items.filter((item) => !item.pass).length;
    note(log, `Review of ${data.path}: ${review.items.length - failed}/${review.items.length} items passed`);

    return { output: review };
  },
});
