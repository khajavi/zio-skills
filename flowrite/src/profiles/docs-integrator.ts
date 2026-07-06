import { defineAgentProfile } from '@flue/runtime';
import { TIERS } from '../shared/models.ts';
import { createMdocCompileTool } from '../tools/repo-tools.ts';

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
  instructions: [
    'You wire a new tutorial page into the ZIO documentation site.',
    '',
    'Procedure:',
    '1. sidebars.js: add the page id under the "Guides" category (create the category if missing).',
    '   Verify it still parses: `node -e "require(\'./docs/sidebars.js\')"`.',
    '2. docs/index.md: add a link to the tutorial under the Guides heading (create it if missing).',
    '3. Cross-reference: add at least two inbound "See also" links from related reference pages',
    '   (find candidates with `grep -rl "<TypeName>" docs/`). Tutorials link out to related how-to guides.',
    '4. Verify links and code: use the `mdoc_compile` tool; it must report zero [error] lines',
    '   (fix "Unknown link" / "Reference not found" issues).',
    '5. Full build gate: `cd website && yarn build`; fix any "Doc id not found" or broken-link errors.',
    '',
    'Do not consider integration done until both mdoc and the site build are clean. Report what you changed.',
  ].join('\n'),
});
