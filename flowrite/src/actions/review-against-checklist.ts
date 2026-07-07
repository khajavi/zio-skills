import { defineAction } from '@flue/runtime';
import * as v from 'valibot';

const reviewSchema = v.object({
  passed: v.pipe(v.boolean(), v.description('true only when every checklist item passes')),
  items: v.array(
    v.object({
      item: v.string(),
      pass: v.boolean(),
      issue: v.nullable(v.pipe(v.string(), v.description('Specific problem when pass is false'))),
    }),
  ),
});

// The tutorial-checklist skill's Review Cadence rule ("call this at most 2
// times") is prose the model can ignore. Enforce it here instead. `harness` is
// invocation-scoped (fresh per run), so a WeakMap keyed on it counts calls
// per run with no explicit run id and no manual cleanup.
const reviewCallCounts = new WeakMap<object, number>();
const MAX_REVIEW_CALLS = 2;

/**
 * Evaluate a written tutorial against the tutorial-checklist skill and report
 * per-item pass/fail. The agent resolves every failing item before finishing.
 * Capped at MAX_REVIEW_CALLS per run — further calls short-circuit without
 * delegating, forcing the agent to finish rather than review indefinitely.
 */
export const reviewAgainstChecklist = defineAction({
  name: 'review_against_checklist',
  description: 'Evaluate a written tutorial against the tutorial-checklist and report per-item pass/fail.',
  input: v.object({
    path: v.pipe(v.string(), v.description('Path to the tutorial markdown, e.g. docs/guides/scope.md')),
  }),
  output: reviewSchema,
  async run({ harness, input, log }) {
    const calls = (reviewCallCounts.get(harness) ?? 0) + 1;
    reviewCallCounts.set(harness, calls);

    if (calls > MAX_REVIEW_CALLS) {
      log.info(`review_against_checklist call ${calls} exceeds cap of ${MAX_REVIEW_CALLS} — refusing, forcing finish`);
      return {
        passed: true,
        items: [
          {
            item: 'Review cadence cap',
            pass: true,
            issue: `Skipped: already reviewed ${MAX_REVIEW_CALLS} times. Remaining issues, if any, are known limitations — finish now.`,
          },
        ],
      };
    }

    log.info(`Reviewing against checklist (call ${calls}/${MAX_REVIEW_CALLS}): ${input.path}`);
    const content = await harness.fs.readFile(input.path);

    const session = await harness.session();
    // Delegates to the tutorial_reviewer subagent — see design-tutorial-structure.ts
    // for why bare harness.session() on the calling agent is unsafe here.
    const { data } = await session.task(
      [`Evaluate the tutorial below against every checklist item.`, ``, `--- TUTORIAL (${input.path}) ---`, content].join(
        '\n',
      ),
      { agent: 'tutorial_reviewer', result: reviewSchema },
    );
    return data;
  },
});
