import * as v from 'valibot';
import type { FlueHarness, FlueLogger } from '@flue/runtime';
import { reviewSchema } from './schemas.ts';
import { runStyleLoop, withTransientRetry } from './style-loop.ts';
import { authorHint } from './author-hint.ts';

type ReviewResult = v.InferOutput<typeof reviewSchema>;
type ReviewItem = ReviewResult['items'][number];

// The checklist's Review Cadence call cap is prose the model can ignore; enforce
// it here instead. `harness` is fresh per action *invocation* (verified: a
// WeakMap keyed on it never accumulated — every call read back as "1"), not per
// workflow run, and ActionContext exposes no run/instance id to key on. These
// module-level singletons work because this repo's actual usage is one process
// per run (run-*.sh execs a fresh node process each time) and a single run only
// ever exercises ONE doc kind's review action — so the shared counter is never
// contended across kinds. It would need a real per-run key if these actions ever
// ran inside a long-lived dev server handling concurrent writer runs.
let reviewCallCount = 0;
// Cache the last REAL review result so the capped call returns the true
// pass/fail + unresolved items instead of a fabricated `passed: true` (which the
// agent misreads as a genuine pass and then reports success over a failing page).
let lastReview: ReviewResult | null = null;
// Default 1 review pass; override per run with MAX_REVIEW_CALLS=n.
const MAX_REVIEW_CALLS = Number(process.env.MAX_REVIEW_CALLS ?? 1);

/**
 * Shared capped-review runner for every review-* action. Runs (optionally) a set
 * of deterministic gates, then the mechanical writing-style loop, then delegates
 * the checklist evaluation to the generic `reviewer` subagent. Combines all three
 * into one per-item pass/fail result, capped at MAX_REVIEW_CALLS per run.
 *
 * Doc-kind variation is supplied by the caller: the checklist content, the noun
 * used in the delegation prompt, the fenced header label, and any extra gates
 * (e.g. method coverage for reference pages). Everything else — the cap, the
 * pre-review snapshot, the style loop, the reviewer delegation, and result
 * assembly — is shared.
 */
export async function runCappedReview(opts: {
  /** Action name for log lines, e.g. 'review_tutorial'. */
  actionName: string;
  /** Noun for the delegation prompt, e.g. 'tutorial' or 'data type reference page'. */
  promptNoun: string;
  /** Fenced header label, e.g. 'TUTORIAL' or 'REFERENCE PAGE'. */
  headerLabel: string;
  checklistDoc: string;
  harness: FlueHarness;
  path: string;
  log: FlueLogger;
  /** Deterministic gates run before the style loop; their items are prepended. */
  extraGates?: () => Promise<ReviewItem[]>;
}): Promise<ReviewResult> {
  const { actionName, harness, path, log } = opts;
  const calls = ++reviewCallCount;

  if (calls > MAX_REVIEW_CALLS) {
    // Return the last REAL result, not a fabricated pass. The cap stops
    // re-running the review; it must not invent a `passed: true` over a page
    // that actually failed.
    const base = lastReview ?? { passed: true, items: [] };
    log.info(
      `${actionName} call ${calls} exceeds cap of ${MAX_REVIEW_CALLS} — returning last result (passed=${base.passed}), forcing finish`,
    );
    return {
      passed: base.passed,
      items: [
        {
          item: 'Review cadence cap',
          pass: base.passed,
          issue: base.passed
            ? `Reviewed ${MAX_REVIEW_CALLS}× — not re-running.`
            : `Reviewed ${MAX_REVIEW_CALLS}× — not re-running. The failing items above are known limitations: finish now and report them in your summary; do NOT call review again.`,
        },
        ...base.items,
      ],
    };
  }

  log.info(`Reviewing against checklist (call ${calls}/${MAX_REVIEW_CALLS}): ${path}`);

  // Snapshot the pre-review version (first call only) so the review phase's edits
  // are diffable afterwards: git diff --no-index .flowrite/pre-review/<file> <path>.
  // Under .flowrite/ with the research cache — all flowrite artifacts in one dir.
  if (calls === 1) {
    const snapshotPath = `.flowrite/pre-review/${path.split('/').pop()}`;
    await harness.fs.writeFile(snapshotPath, await harness.fs.readFile(path));
    log.info(`Pre-review snapshot saved: ${snapshotPath}`);
  }

  // Deterministic gates first (e.g. method coverage), so the checklist review
  // below sees any flags they raise surfaced as items.
  const extraItems = opts.extraGates ? await opts.extraGates() : [];

  // Style pass next: detects violations rule group by rule group and fixes each
  // group in a single style_fixer pass, so the checklist review below sees the
  // corrected page. Unfixable violations surface as failing items.
  const style = await runStyleLoop(harness, path, log);
  const styleItems: ReviewItem[] = style.passed
    ? [{ item: 'Writing style (all 25 rules, checked mechanically)', pass: true, issue: null }]
    : style.remaining.map((x) => ({
        item: `writing-style rule ${x.rule} @ line ${x.line}`,
        pass: false,
        issue: x.problem,
      }));

  const content = await harness.fs.readFile(path);

  const session = await harness.session();
  // Delegates to the generic reviewer subagent — see design-tutorial-structure.ts
  // for why bare harness.session() on the calling agent is unsafe here. The
  // kind-specific checklist is injected into the prompt at the call site.
  const { data } = await withTransientRetry(log, 'reviewer', () =>
    session.task(
      [
        `Evaluate the ${opts.promptNoun} below against every item in this checklist:`,
        ``,
        opts.checklistDoc,
        // Placed before the content delimiter so the hint reads as reviewer
        // guidance, not as part of the page under review.
        authorHint(),
        ``,
        `--- ${opts.headerLabel} (${path}) ---`,
        content,
      ].join('\n'),
      { agent: 'reviewer', result: reviewSchema },
    ),
  );

  const result: ReviewResult = {
    passed: data.passed && style.passed && extraItems.every((i) => i.pass),
    items: [...extraItems, ...styleItems, ...data.items],
  };
  lastReview = result; // cache the real result for a possible capped follow-up call
  return result;
}
