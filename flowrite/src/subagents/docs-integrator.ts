import { defineSubagent } from '@flue/runtime';
import { TIERS } from '../runtime/models.ts';
import instructions from './docs-integrator.md';

/**
 * Docs-site integration specialist. Wires a finished tutorial into the
 * Docusaurus site (sidebar, index, cross-references) and verifies the build,
 * editing files and running commands in the parent's sandbox.
 */
export function DocsIntegrator() {
  return instructions;
}

export const docsIntegrator = defineSubagent({
  name: 'docs_integrator',
  ...TIERS.integrator,
  description:
    'Integrates a finished tutorial into the Docusaurus site: sidebars.js, index.md, cross-references, and build verification. Use after mdoc passes.',
  agent: DocsIntegrator,
});
