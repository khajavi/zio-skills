import { defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';
import dataTypeRefWriter from '../agents/data-type-ref-writer.ts';

/**
 * Review-only entrypoint: runs the review phase (mechanical style loop +
 * checklist evaluation) on an existing reference page without touching the
 * other phases. Useful for re-reviewing archived or hand-edited pages.
 * Mirrors review-tutorial.ts.
 */
export const route: WorkflowRouteHandler = async (_c, next) => next();

export default defineWorkflow({
  agent: dataTypeRefWriter,
  input: v.object({
    projectPath: v.pipe(v.string(), v.description('Absolute path to the library checkout containing the page')),
    path: v.pipe(v.string(), v.description('Reference page path relative to the checkout, e.g. docs/reference/chunk.md')),
    typeName: v.pipe(v.string(), v.description('The documented type, e.g. "Chunk" — used for method-coverage')),
  }),
  output: v.object({
    passed: v.boolean(),
    items: v.array(v.object({ item: v.string(), pass: v.boolean(), issue: v.nullable(v.string()) })),
  }),
  async run({ harness, input, log }) {
    process.env.REPO_PATH = input.projectPath;
    process.env.SKIP_PHASES = '[]';

    const session = await harness.session();
    const { data } = await session.prompt(
      `Only call the review_data_type_ref action with path ${input.path} and typeName ${input.typeName}, ` +
        `then finish. Do NOT run research, design, write, mdoc, examples, or integrate — the page ` +
        `already exists; this is a review-only session. Report the review result verbatim.`,
      {
        result: v.object({
          passed: v.boolean(),
          items: v.array(v.object({ item: v.string(), pass: v.boolean(), issue: v.nullable(v.string()) })),
        }),
      },
    );
    log.info(`review-data-type-ref result: passed=${data.passed}, items=${data.items.length}`);
    return data;
  },
});
