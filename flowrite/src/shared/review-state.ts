import type * as v from 'valibot';
import type { reviewSchema } from './schemas.ts';

type ReviewResult = v.InferOutput<typeof reviewSchema>;

/**
 * The last review's verdict, recorded so `report_run_result` can check the model's claim against it.
 *
 * This survives the removal of the review machinery because it guards a different thing: with only a
 * prose instruction, two measured runs filed "Complete Prism reference page …" over a `passed: false`
 * review that had named its failures twice. The gate needs the real verdict, whoever produced it.
 *
 * Module-level state, deliberately: this repo runs one OS process per run (each run-*.sh execs a fresh
 * node), and a run only ever exercises one document kind.
 */
let lastReview: ReviewResult | null = null;

/** Record a review's outcome. Called by the review phase after each evaluation. */
export function recordReview(result: ReviewResult): void {
  lastReview = result;
}

/** The last review result, or null when none ran this process. */
export function getLastReview(): ReviewResult | null {
  return lastReview;
}

/** The failing items of the last review, by name. Empty when it passed or none ran. */
export function failingReviewItems(): string[] {
  return (lastReview?.items ?? []).filter((item) => !item.pass).map((item) => item.item);
}

/**
 * Seed the cached review from a test. Not for production code — the cache is module state, which
 * leaves no other seam for a test to drive `report_run_result`'s verdict gate.
 */
export function __setLastReviewForTests(result: ReviewResult | null): void {
  lastReview = result;
}
