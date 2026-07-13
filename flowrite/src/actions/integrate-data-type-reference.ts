import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { isPhaseSkipped } from '../shared/skip-phases.ts';

export const integrateDataTypeReferenceOutput = v.object({
  skipped: v.boolean(),
  summary: v.string(),
});

/**
 * Wire a finished reference page into the Docusaurus site. Reuses the generic
 * docs_integrator subagent (its .md takes the target category from this prompt),
 * stating the **Reference** category rather than the tutorial "Guides" one.
 * Checks the skip list before delegating — see review-tutorial.ts (action) for
 * why this must live in code, not only as prose.
 */
export const integrateDataTypeReference = defineAction({
  name: 'integrate_data_type_reference',
  description: 'Wire a finished data type reference page into the Docusaurus site under the Reference category.',
  input: v.object({
    pagePath: v.pipe(v.string(), v.description('Path to the reference markdown, e.g. docs/reference/chunk.md')),
  }),
  output: integrateDataTypeReferenceOutput,
  async run({ harness, input, log }) {
    if (isPhaseSkipped('integrate')) {
      log.info('Skipping integration (skipPhases)');
      return { skipped: true, summary: 'Skipped by request.' };
    }

    log.info(`Integrating reference page into docs site: ${input.pagePath}`);
    const session = await harness.session();
    // Delegates to the docs_integrator subagent — see design-tutorial-structure.ts
    // for why bare harness.session() on the calling agent is unsafe here.
    const { data } = await session.task(
      `Integrate the documentation page at ${input.pagePath} into the Docusaurus site under the ` +
        `"Reference" category: sidebars.js, docs/index.md, cross-references, and full link verification. ` +
        `Reference pages are typically linked TO from tutorials and how-to guides — add inbound ` +
        `"See also" links from those pages where relevant.`,
      { agent: 'docs_integrator', result: integrateDataTypeReferenceOutput },
    );
    return data;
  },
});
