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

/**
 * Evaluate a written tutorial against the tutorial-checklist skill and report
 * per-item pass/fail. The agent resolves every failing item before finishing.
 */
export const reviewAgainstChecklist = defineAction({
  name: 'review_against_checklist',
  description: 'Evaluate a written tutorial against the tutorial-checklist and report per-item pass/fail.',
  input: v.object({
    path: v.pipe(v.string(), v.description('Path to the tutorial markdown, e.g. docs/guides/scope.md')),
  }),
  output: reviewSchema,
  async run({ harness, input, log }) {
    log.info(`Reviewing against checklist: ${input.path}`);
    const content = await harness.fs.readFile(input.path);

    const session = await harness.session();
    const { data } = await session.prompt(
      [
        `Load the tutorial-checklist skill.`,
        `Evaluate the tutorial below against every checklist item.`,
        `Return each item with pass/fail; when failing, give a specific, actionable issue.`,
        `Set passed=true only if every item passes.`,
        ``,
        `--- TUTORIAL (${input.path}) ---`,
        content,
      ].join('\n'),
      { result: reviewSchema },
    );
    return data;
  },
});
