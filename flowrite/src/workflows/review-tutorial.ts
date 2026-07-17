import { defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';
import tutorialWriter from '../agents/tutorial-writer.ts';

/**
 * Review-only entrypoint: runs the review phase (mechanical style loop +
 * checklist evaluation) on an existing tutorial without touching the other
 * phases. Useful for re-reviewing archived or hand-edited tutorials.
 */
export const route: WorkflowRouteHandler = async (_c, next) => next();

export default defineWorkflow({
  agent: tutorialWriter,
  input: v.object({
    projectPath: v.pipe(v.string(), v.description('Absolute path to the library checkout containing the tutorial')),
    path: v.pipe(v.string(), v.description('Tutorial path relative to the checkout, e.g. docs/guides/prism.md')),
    userPrompt: v.pipe(
      v.optional(v.string()),
      v.description('Optional free-form hint to steer the run, e.g. scope, emphasis, or known gotchas.'),
    ),
  }),
  output: v.object({
    passed: v.boolean(),
    items: v.array(v.object({ item: v.string(), pass: v.boolean(), issue: v.nullable(v.string()) })),
  }),
  async run({ harness, input, log }) {
    process.env.REPO_PATH = input.projectPath;
    process.env.SKIP_PHASES = '[]';
    process.env.USER_PROMPT = input.userPrompt ?? ''; // read by authorHint() in shared/review.ts

    const session = await harness.session();
    const { data } = await session.prompt(
      `Only call the review_tutorial action with path ${input.path}, then finish. ` +
        `Do NOT run research, design, write, examples, mdoc, or integrate — the tutorial ` +
        `already exists; this is a review-only session. Report the review result verbatim.` +
        (input.userPrompt ? ` Author hint to steer this run: ${input.userPrompt}` : ''),
      {
        result: v.object({
          passed: v.boolean(),
          items: v.array(v.object({ item: v.string(), pass: v.boolean(), issue: v.nullable(v.string()) })),
        }),
      },
    );
    log.info(`review-tutorial result: passed=${data.passed}, items=${data.items.length}`);
    return data;
  },
});
