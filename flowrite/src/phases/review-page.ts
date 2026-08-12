import { type FlueHarness, type FlueLogger, defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { isPhaseSkipped } from '../shared/skip-phases.ts';
import { reviewSchema } from '../shared/schemas.ts';
import { authorHint } from '../shared/run-context.ts';
import { delegate } from '../shared/delegate.ts';
// Each kind's checklist and the writing-style rules, injected into the generic reviewer's task
// (skills are role-owned and cannot vary per delegated task). Same source-of-truth split as before:
// the SKILL.md files point at these.
import rulesMarkdown from '../skills/writing-style/references/rules.md';
import dataTypeChecklistDoc from '../skills/data-type-ref-checklist/references/checklist.md';
import moduleChecklistDoc from '../skills/module-ref-checklist/references/checklist.md';
import tutorialChecklistDoc from '../skills/tutorial-checklist/references/checklist.md';

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
async function reviewPage(opts: {
  harness: FlueHarness;
  log: FlueLogger;
  path: string;
  checklistDoc: string;
  /** Noun for the delegation prompt, e.g. 'data type reference page'. */
  promptNoun: string;
  /** Fenced header label, e.g. 'REFERENCE PAGE'. */
  headerLabel: string;
}): Promise<v.InferOutput<typeof reviewSchema>> {
  if (isPhaseSkipped('review')) {
    return { passed: true, items: [{ item: 'Review', pass: true, issue: 'Skipped by request.' }] };
  }

  const content = await opts.harness.sandbox.readFile(opts.path);
  const data = await delegate({
    harness: opts.harness,
    log: opts.log,
    label: 'reviewer',
    role: 'reviewer',
    result: reviewSchema,
    prompt: [
      `Evaluate the ${opts.promptNoun} below against every item in this checklist:`,
      ``,
      opts.checklistDoc,
      ``,
      `Also check it against every one of these writing style rules, reporting each violation as a`,
      `failing item named "writing-style rule <N>" with the line and a specific, actionable issue:`,
      ``,
      rulesMarkdown,
      // Before the content delimiter, so the hint reads as reviewer guidance rather than as part of
      // the page under review.
      authorHint(),
      ``,
      `--- ${opts.headerLabel} (${opts.path}) ---`,
      content,
    ].join('\n'),
  });

  return data;
}

/** Review a data type reference page against the data-type-ref checklist and the style rules. */
export const reviewDataTypeRef = defineTool({
  name: 'review_data_type_ref',
  description:
    'Review a data type reference page against the data-type-ref-checklist and the writing style ' +
    'rules; report per-item pass/fail. Fix the failures yourself, then call it again to confirm.',
  harness: true,
  input: v.object({
    path: v.pipe(v.string(), v.description('Path to the reference markdown, e.g. docs/reference/chunk.md')),
  }),
  output: reviewSchema,
  async run({ harness, data, log }) {
    return {
      output: await reviewPage({
        harness,
        log,
        path: data.path,
        checklistDoc: dataTypeChecklistDoc,
        promptNoun: 'data type reference page',
        headerLabel: 'REFERENCE PAGE',
      }),
    };
  },
});

/** Review a module reference page against the module-ref checklist and the style rules. */
export const reviewModuleRef = defineTool({
  name: 'review_module_ref',
  description:
    'Review a module reference against the module-ref-checklist and the writing style rules; report ' +
    'per-item pass/fail. Fix the failures yourself, then call it again to confirm.',
  harness: true,
  input: v.object({
    path: v.pipe(
      v.string(),
      v.description('The module page to review: the flat page or the hierarchical index'),
    ),
  }),
  output: reviewSchema,
  async run({ harness, data, log }) {
    return {
      output: await reviewPage({
        harness,
        log,
        path: data.path,
        checklistDoc: moduleChecklistDoc,
        promptNoun: 'module reference page',
        headerLabel: 'MODULE REFERENCE',
      }),
    };
  },
});

/** Review a tutorial against the tutorial checklist and the style rules. */
export const reviewTutorial = defineTool({
  name: 'review_tutorial',
  description:
    'Evaluate a written tutorial against the tutorial-checklist and the writing style rules; report ' +
    'per-item pass/fail. Fix the failures yourself, then call it again to confirm.',
  harness: true,
  input: v.object({
    path: v.pipe(v.string(), v.description('Path to the tutorial markdown, e.g. docs/guides/scope.md')),
  }),
  output: reviewSchema,
  async run({ harness, data, log }) {
    return {
      output: await reviewPage({
        harness,
        log,
        path: data.path,
        checklistDoc: tutorialChecklistDoc,
        promptNoun: 'tutorial',
        headerLabel: 'TUTORIAL',
      }),
    };
  },
});
