import { defineAgentProfile } from '@flue/runtime';
import { TIERS } from '../shared/models.ts';
import { createGhQueryTool } from '../tools/repo-tools.ts';
import instructions from './researcher.md' with { type: 'markdown' };

// REPO_PATH is required before `flue run` starts (see tutorial-writer.ts's own cwd check).
const ghQuery = createGhQueryTool(process.env.REPO_PATH!);

/**
 * Generic deep source-research specialist, shared across document kinds. Runs
 * read-only over the library checkout in the parent's sandbox (glob/grep/read
 * via built-in shell), plus `gh_query` for GitHub history. The calling action
 * supplies the kind-specific focus and result schema, so this profile itself
 * stays document-kind-neutral. It does not write files.
 */
export const researcher = defineAgentProfile({
  name: 'researcher',
  ...TIERS.researcher,
  description:
    'Researches a ZIO topic across source, tests, examples, and GitHub history; returns structured research answers in the shape the caller requests.',
  tools: [ghQuery],
  instructions,
});
