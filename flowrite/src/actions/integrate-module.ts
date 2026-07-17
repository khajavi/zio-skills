import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { integrateOutput } from './integrate.ts';
import { isPhaseSkipped } from '../shared/skip-phases.ts';
import { authorHint } from '../shared/author-hint.ts';
import { withTransientRetry } from '../shared/style-loop.ts';

/**
 * Wire a finished module reference into the Docusaurus site under the Reference
 * category. Layout-aware — a flat module is a single sidebar doc entry, a
 * hierarchical module is a sidebar category (index + one child per type). Because
 * the sidebar shape depends on the layout, this can't reuse defineIntegrateAction
 * (which threads only a path); it takes the layout and builds the right prompt.
 * Delegates to the generic docs_integrator subagent — see integrate.ts.
 */
export const integrateModuleReference = defineAction({
  name: 'integrate_module_reference',
  description: 'Wire a finished module reference into the Docusaurus site under the Reference category (flat doc entry or hierarchical category).',
  input: v.object({
    pagePath: v.pipe(v.string(), v.description('Path to the flat page or the hierarchical index, e.g. docs/reference/http-model.md or docs/reference/http-model/index.md')),
    layout: v.picklist(['flat', 'hierarchical']),
  }),
  output: integrateOutput,
  async run({ harness, input, log }) {
    if (isPhaseSkipped('integrate')) {
      log.info('Skipping integration (skipPhases)');
      return { skipped: true, summary: 'Skipped by request.' };
    }

    log.info(`Integrating ${input.layout} module reference into docs site: ${input.pagePath}`);
    const session = await harness.session();

    const sidebarInstruction =
      input.layout === 'flat'
        ? `Add a single sidebar "doc" entry for this page under the "Reference" category.`
        : `Add a sidebar "category" under "Reference": link it to the index (${input.pagePath}) and ` +
          `list every per-type subpage in the same directory as its child "reference/<module>/<type>" items, in reading order.`;

    const { data } = await withTransientRetry(log, 'docs_integrator (module)', () =>
      session.task(
      [
        `Integrate the module reference at ${input.pagePath} into the Docusaurus site under the`,
        `"Reference" category: sidebars.js, docs/index.md, cross-references, and full link verification.`,
        sidebarInstruction,
        `Module references are typically linked TO from tutorials, how-to guides, and data type`,
        `reference pages — add inbound "See also" links from those pages where relevant.`,
      ].join('\n') + authorHint(),
      { agent: 'docs_integrator', result: integrateOutput },
    ));
    return data;
  },
});
