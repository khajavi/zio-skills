import { defineAgentProfile } from '@flue/runtime';
import { TIERS } from '../shared/models.ts';
import instructions from './docs-integrator.md' with { type: 'markdown' };

/**
 * Docs-site integration specialist. Wires a finished tutorial into the
 * Docusaurus site (sidebar, index, cross-references) and verifies the build,
 * editing files and running commands in the parent's sandbox.
 */
export const docsIntegrator = defineAgentProfile({
  name: 'docs_integrator',
  ...TIERS.integrator,
  description:
    'Integrates a finished tutorial into the Docusaurus site: sidebars.js, index.md, cross-references, and build verification. Use after mdoc passes.',
  instructions,
});
