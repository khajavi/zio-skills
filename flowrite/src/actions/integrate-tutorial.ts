import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { isPhaseSkipped } from '../shared/skip-phases.ts';

export const integrateTutorialOutput = v.object({
  skipped: v.boolean(),
  summary: v.string(),
});

/**
 * Wire a finished tutorial into the Docusaurus site. Checks the skip list
 * before ever delegating — see review-tutorial.ts (action) for why this
 * check must live in code, not only as prose in tutorial-writer.md.
 */
export const integrateTutorial = defineAction({
  name: 'integrate_tutorial',
  description: 'Wire a finished tutorial into the Docusaurus site (sidebar, index, cross-references).',
  input: v.object({
    tutorialPath: v.pipe(v.string(), v.description('Path to the tutorial markdown, e.g. docs/guides/scope.md')),
  }),
  output: integrateTutorialOutput,
  async run({ harness, input, log }) {
    if (isPhaseSkipped('integrate')) {
      log.info('Skipping integration (skipPhases)');
      return { skipped: true, summary: 'Skipped by request.' };
    }

    log.info(`Integrating tutorial into docs site: ${input.tutorialPath}`);
    const session = await harness.session();
    // Delegates to the docs_integrator subagent — see design-tutorial-structure.ts
    // for why bare harness.session() on the calling agent is unsafe here.
    const { data } = await session.task(
      `Integrate the tutorial at ${input.tutorialPath} into the Docusaurus site: sidebars.js, ` +
        `docs/index.md, cross-references, and full link verification.`,
      { agent: 'docs_integrator', result: integrateTutorialOutput },
    );
    return data;
  },
});
