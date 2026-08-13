import { type FlueHarness, type FlueLogger, defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { isPhaseSkipped } from '../../runtime/skip-phases.ts';
import { authorHint } from '../../runtime/run-context.ts';
import { delegate } from '../../runtime/delegate.ts';

/**
 * The integrate phase: wire a finished page into the Docusaurus site — sidebars.js, docs/index.md,
 * cross-references, link verification.
 *
 * ONE body, THREE tools, the same shape as research.ts, design-doc-plan.ts and write-doc.ts. Each
 * kind mounts exactly one of these, and they are three rather than one because their inputs genuinely
 * differ: a module reference needs its layout and type groups to build the right sidebar shape, while a
 * tutorial or a data type page needs only its path. Folding those into optional fields would make them
 * required-for-one-kind, which is a contract the model has to infer instead of being handed.
 *
 * This replaces a `defineIntegrateAction` factory that lived here and a second module,
 * integrate-module.ts, that could not use it — "because the sidebar shape depends on the layout, this
 * can't reuse defineIntegrateAction (which threads only a path)". That was an argument for changing the
 * factory rather than adding a file. The factory's one parameter of substance was the *name* of the
 * input field (`tutorialPath` for a tutorial, `pagePath` for everything else), which cost a
 * `(data as Record<string, string>)[opts.inputKey]` cast to read back. Both names meant "the finished
 * page", so both are `pagePath` now and the cast is gone.
 */

/** Shared output of every doc-integration tool. */
export const integrateOutput = v.object({
  skipped: v.boolean(),
  summary: v.string(),
});

/** The page to wire in. One field, one name, for every kind. */
const pagePathInput = (description: string) =>
  v.object({ pagePath: v.pipe(v.string(), v.description(description)) });

/**
 * Hand one page to the generic `docs_integrator` subagent.
 *
 * Delegated rather than done in the calling conversation for the reason design-doc-plan.ts
 * explains. The skip check lives here in code, not as prose in the agent's .md, because a phase the
 * model is merely *asked* to skip is a phase it can decide to run.
 */
async function integratePage(opts: {
  harness: FlueHarness;
  log: FlueLogger;
  /** Log/delegation label, e.g. 'docs_integrator (module)'. */
  label: string;
  /** What the phase announces it is wiring in, e.g. 'reference page'. */
  integrating: string;
  path: string;
  /** The task lines; `authorHint()` is appended. */
  prompt: string[];
}): Promise<v.InferOutput<typeof integrateOutput>> {
  if (isPhaseSkipped('integrate')) {
    opts.log.info('Skipping integration (skipPhases)');
    return { skipped: true, summary: 'Skipped by request.' };
  }

  opts.log.info(`Integrating ${opts.integrating} into docs site: ${opts.path}`);
  return await delegate({
    harness: opts.harness,
    log: opts.log,
    label: opts.label,
    role: 'docs_integrator',
    result: integrateOutput,
    prompt: opts.prompt.join('\n') + authorHint(),
  });
}

/** The closing line every integration shares: what "integrated" means. */
const SITE_WIRING = `sidebars.js, docs/index.md, cross-references, and full link verification.`;

/** Wire a finished tutorial into the site. */
export const integrateTutorial = defineTool({
  name: 'integrate_tutorial',
  description: 'Wire a finished tutorial into the Docusaurus site (sidebar, index, cross-references).',
  harness: true,
  input: pagePathInput('Path to the tutorial markdown, e.g. docs/guides/scope.md'),
  output: integrateOutput,
  async run({ harness, data, log }) {
    return {
      output: await integratePage({
        harness,
        log,
        label: 'docs_integrator',
        integrating: 'tutorial',
        path: data.pagePath,
        prompt: [`Integrate the tutorial at ${data.pagePath} into the Docusaurus site: ${SITE_WIRING}`],
      }),
    };
  },
});

/** Wire a finished data type reference page into the site under the Reference category. */
export const integrateDataTypeReference = defineTool({
  name: 'integrate_data_type_reference',
  description: 'Wire a finished data type reference page into the Docusaurus site under the Reference category.',
  harness: true,
  input: pagePathInput('Path to the reference markdown, e.g. docs/reference/chunk.md'),
  output: integrateOutput,
  async run({ harness, data, log }) {
    return {
      output: await integratePage({
        harness,
        log,
        label: 'docs_integrator',
        integrating: 'reference page',
        path: data.pagePath,
        prompt: [
          `Integrate the documentation page at ${data.pagePath} into the Docusaurus site under the`,
          `"Reference" category: ${SITE_WIRING}`,
          `Reference pages are typically linked TO from tutorials and how-to guides — add inbound`,
          `"See also" links from those pages where relevant.`,
        ],
      }),
    };
  },
});

/**
 * Wire a finished module reference into the site under the Reference category.
 *
 * Layout-aware, which is why this kind keeps a wider input than the other two: a flat module is a
 * single sidebar doc entry, a hierarchical one is a category (index plus a child per type), and a
 * hierarchical module with named type groups is a category of sub-categories.
 */
export const integrateModuleReference = defineTool({
  name: 'integrate_module_reference',
  description:
    'Wire a finished module reference into the Docusaurus site under the Reference category (flat doc entry or hierarchical category).',
  harness: true,
  input: v.object({
    pagePath: v.pipe(
      v.string(),
      v.description(
        'Path to the flat page or the hierarchical index, e.g. docs/reference/http-model.md or docs/reference/http-model/index.md',
      ),
    ),
    layout: v.picklist(['flat', 'hierarchical']),
    typeGroups: v.pipe(
      v.optional(
        v.array(
          v.object({
            label: v.pipe(v.string(), v.description('Sidebar sub-category name, e.g. "Core Data Types", "Routing"')),
            subpageIds: v.pipe(
              v.array(v.string()),
              v.description('Subpage ids in reading order, e.g. "reference/http-model/request"'),
            ),
          }),
        ),
      ),
      v.description('Hierarchical only: named type groups → one sidebar sub-category each, in order. Omit for a single flat listing.'),
    ),
  }),
  output: integrateOutput,
  async run({ harness, data, log }) {
    const groups = data.layout === 'hierarchical' ? data.typeGroups : undefined;
    const sidebarInstruction =
      data.layout === 'flat'
        ? `Add a single sidebar "doc" entry for this page under the "Reference" category.`
        : groups?.length
          ? `Add a sidebar "category" under "Reference" linked to the index (${data.pagePath}), with one ` +
            `child sub-category per group (in this order): ${JSON.stringify(groups)} — each group's label ` +
            `is the sub-category name and its subpageIds are the "doc" children, in the given order. ` +
            `For nested ids ("reference/<module>/<sub-domain>/<type>"), link each sub-category to its sub-domain index doc.`
          : `Add a sidebar "category" under "Reference": link it to the index (${data.pagePath}) and ` +
            `list every per-type subpage in the same directory as its child "reference/<module>/<type>" items, in reading order.`;

    return {
      output: await integratePage({
        harness,
        log,
        label: 'docs_integrator (module)',
        integrating: `${data.layout} module reference`,
        path: data.pagePath,
        prompt: [
          `Integrate the module reference at ${data.pagePath} into the Docusaurus site under the`,
          `"Reference" category: ${SITE_WIRING}`,
          sidebarInstruction,
          `Module references are typically linked TO from tutorials, how-to guides, and data type`,
          `reference pages — add inbound "See also" links from those pages where relevant.`,
        ],
      }),
    };
  },
});
