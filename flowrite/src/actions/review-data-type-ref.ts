import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { isPhaseSkipped } from '../shared/skip-phases.ts';
import { runStyleLoop, withTransientRetry } from '../shared/style-loop.ts';
import { computeMethodCoverage } from '../tools/check-method-coverage.ts';
import { reviewSchema } from '../shared/schemas.ts';
// The data-type-ref-checklist skill's content, injected into the generic reviewer's
// task (skills can't vary per session.task call). Same source-of-truth split as
// writing-style/references/rules.md; the SKILL.md points here.
import dataTypeChecklistDoc from '../skills/data-type-ref-checklist/references/checklist.md' with { type: 'markdown' };

// Enforce the checklist's Review Cadence call cap in code — see review-tutorial.ts
// for the full rationale (module-level counter is safe under this repo's
// one-process-per-run usage).
let reviewCallCount = 0;
// Cache the last REAL review result so the capped call can return the true
// pass/fail + unresolved items — never a fabricated `passed: true`, which the
// agent misreads as a genuine pass and then reports success over a failing page.
let lastReview: v.InferOutput<typeof reviewSchema> | null = null;
const MAX_REVIEW_CALLS = Number(process.env.MAX_REVIEW_CALLS ?? 1);

/**
 * Evaluate a written data type reference page. The review phase is the single
 * quality gate for a reference page: it runs (1) deterministic method-coverage
 * (is every public member documented?), (2) the mechanical writing-style loop,
 * and (3) the data-type-ref-checklist (structure + content + technical accuracy).
 * Capped at MAX_REVIEW_CALLS per run. Mirrors review-tutorial.ts.
 */
export const reviewDataTypeRef = defineAction({
  name: 'review_data_type_ref',
  description: 'Review a data type reference page: method coverage + writing-style + the data-type-ref-checklist; report per-item pass/fail.',
  input: v.object({
    path: v.pipe(v.string(), v.description('Path to the reference markdown, e.g. docs/reference/chunk.md')),
    typeName: v.pipe(v.string(), v.description('The documented type, e.g. "Chunk" — used for method-coverage')),
  }),
  output: reviewSchema,
  async run({ harness, input, log }) {
    if (isPhaseSkipped('review')) {
      log.info('Skipping review (skipPhases)');
      return { passed: true, items: [{ item: 'Review', pass: true, issue: 'Skipped by request.' }] };
    }

    const calls = ++reviewCallCount;

    if (calls > MAX_REVIEW_CALLS) {
      // Return the last REAL result, not a fabricated pass. The cap stops
      // re-running the review; it must not invent a `passed: true` over a page
      // that actually failed.
      const base = lastReview ?? { passed: true, items: [] };
      log.info(
        `review_data_type_ref call ${calls} exceeds cap of ${MAX_REVIEW_CALLS} — returning last result (passed=${base.passed}), forcing finish`,
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

    log.info(`Reviewing against checklist (call ${calls}/${MAX_REVIEW_CALLS}): ${input.path}`);

    // Snapshot the pre-review version (first call only) so the review phase's
    // edits are diffable: git diff --no-index .pre-review/<file> <path>
    if (calls === 1) {
      const snapshotPath = `.pre-review/${input.path.split('/').pop()}`;
      await harness.fs.writeFile(snapshotPath, await harness.fs.readFile(input.path));
      log.info(`Pre-review snapshot saved: ${snapshotPath}`);
    }

    // Method coverage first (deterministic): does the page document every public
    // member? Folded into review so coverage is one of the review phase's gates,
    // not a separate step. Heuristic (see computeMethodCoverage), so a non-empty
    // `missing` is a flag to check, surfaced as a review item.
    const coverage = await computeMethodCoverage(process.env.REPO_PATH!, input.typeName, input.path);
    const coverageItem = {
      item: `Method coverage (${coverage.coveragePercent}%)`,
      pass: coverage.missing.length === 0,
      issue:
        coverage.missing.length === 0
          ? null
          : `Undocumented public members (heuristic — verify against source, then document or justify): ${coverage.missing.join(', ')}. ${coverage.note}`,
    };

    // Style pass next: rule-agnostic mechanical loop over the same 25 writing-style
    // rules, so the checklist review below sees the corrected page.
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
          `Evaluate the data type reference page below against every item in this checklist:`,
          ``,
          dataTypeChecklistDoc,
          ``,
          `--- REFERENCE PAGE (${input.path}) ---`,
          content,
        ].join('\n'),
        { agent: 'reviewer', result: reviewSchema },
      ),
    );
    const result = {
      passed: data.passed && style.passed && coverageItem.pass,
      items: [coverageItem, ...styleItems, ...data.items],
    };
    lastReview = result; // cache the real result for a possible capped follow-up call
    return result;
  },
});
