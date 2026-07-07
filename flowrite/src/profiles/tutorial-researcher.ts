import { defineAgentProfile } from '@flue/runtime';
import { TIERS } from '../shared/models.ts';
import { createGhQueryTool } from '../tools/repo-tools.ts';
import instructions from './tutorial-researcher.md' with { type: 'markdown' };

// REPO_PATH is required before `flue run` starts (see tutorial-writer.ts's own cwd check).
const ghQuery = createGhQueryTool(process.env.REPO_PATH!);

/**
 * Deep source-research specialist. Runs read-only over the library checkout in
 * the parent's sandbox (glob/grep/read via built-in shell), plus `gh_query` for
 * GitHub history. Returns structured answers the tutorial designer needs. It
 * does not write files.
 */
export const tutorialResearcher = defineAgentProfile({
  name: 'tutorial_researcher',
  ...TIERS.researcher,
  description:
    'Researches a ZIO topic across source, tests, examples, and GitHub history; returns structured research answers. Use before designing a tutorial.',
  tools: [ghQuery],
  instructions,
});
