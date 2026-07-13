import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { isPhaseSkipped } from '../shared/skip-phases.ts';
import { runStyleLoop, withTransientRetry } from '../shared/style-loop.ts';
// The tutorial-checklist skill's content, injected into the generic reviewer's
// task (skills can't vary per session.task call). Same source-of-truth split as
// writing-style/references/rules.md; the SKILL.md points here.
import tutorialChecklistDoc from '../skills/tutorial-checklist/references/checklist.md' with { type: 'markdown' };

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

// The tutorial-checklist skill's Review Cadence call cap is prose the model
// can ignore. Enforce it here instead. `harness` is
// fresh per action *invocation* (verified: a WeakMap keyed on it never
// accumulated — every call read back as "1"), not per workflow run, and
// ActionContext exposes no run/instance id to key on. This module-level
// counter works because this repo's actual usage is one process per tutorial
// (run-tutorial.sh execs a fresh node process each time) — it would need a
// real per-run key if this action ever runs inside a long-lived dev server
// handling concurrent tutorial-writer runs.
let reviewCallCount = 0;
// Default 1 review pass; override per run with MAX_REVIEW_CALLS=n.
const MAX_REVIEW_CALLS = Number(process.env.MAX_REVIEW_CALLS ?? 1);

/**
 * Evaluate a written tutorial against the tutorial-checklist skill and report
 * per-item pass/fail. The agent resolves every failing item before finishing.
 * Capped at MAX_REVIEW_CALLS per run — further calls short-circuit without
 * delegating, forcing the agent to finish rather than review indefinitely.
 */
export const reviewTutorial = defineAction({
  name: 'review_tutorial',
  description: 'Evaluate a written tutorial against the tutorial-checklist and report per-item pass/fail.',
  input: v.object({
    path: v.pipe(v.string(), v.description('Path to the tutorial markdown, e.g. docs/guides/scope.md')),
  }),
  output: reviewSchema,
  async run({ harness, input, log }) {
    if (isPhaseSkipped('review')) {
      log.info('Skipping review (skipPhases)');
      return { passed: true, items: [{ item: 'Review', pass: true, issue: 'Skipped by request.' }] };
    }

    const calls = ++reviewCallCount;

    if (calls > MAX_REVIEW_CALLS) {
      log.info(`review_tutorial call ${calls} exceeds cap of ${MAX_REVIEW_CALLS} — refusing, forcing finish`);
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

    // Snapshot the pre-review version (first call only) so the review phase's
    // edits are diffable afterwards: git diff --no-index .pre-review/<file> <path>
    if (calls === 1) {
      const snapshotPath = `.pre-review/${input.path.split('/').pop()}`;
      await harness.fs.writeFile(snapshotPath, await harness.fs.readFile(input.path));
      log.info(`Pre-review snapshot saved: ${snapshotPath}`);
    }

    // Style pass first: detects violations rule group by rule group and fixes
    // each group in a single style_fixer pass, so the checklist review below
    // sees the corrected page. Unfixable violations surface as failing items.
    const style = await runStyleLoop(harness, input.path, log);
    const styleItems = style.passed
      ? [{ item: 'Writing style (all 25 rules, checked mechanically)', pass: true, issue: null }]
      : style.remaining.map((x) => ({
          item: `writing-style rule ${x.rule} @ line ${x.line}`,
          pass: false,
          issue: x.problem,
        }));

    const content = await harness.fs.readFile(input.path);

    const session = await harness.session();
    // Delegates to the generic reviewer subagent — see design-tutorial-structure.ts
    // for why bare harness.session() on the calling agent is unsafe here. The
    // kind-specific checklist is injected into the prompt at the call site.
    const { data } = await withTransientRetry(log, 'reviewer', () =>
      session.task(
        [
          `Evaluate the tutorial below against every item in this checklist:`,
          ``,
          tutorialChecklistDoc,
          ``,
          `--- TUTORIAL (${input.path}) ---`,
          content,
        ].join('\n'),
        { agent: 'reviewer', result: reviewSchema },
      ),
    );
    return { passed: data.passed && style.passed, items: [...styleItems, ...data.items] };
  },
});
