import { defineAgentProfile } from '@flue/runtime';
import { TIERS } from '../shared/models.ts';
import { createMdocCompileTool } from '../tools/repo-tools.ts';
import instructions from './docs-integrator.md' with { type: 'markdown' };

// REPO_PATH is required before `flue run` starts (see tutorial-writer.ts's own cwd check).
const mdocCompile = createMdocCompileTool(process.env.REPO_PATH!);

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
  tools: [mdocCompile],
  instructions,
});
