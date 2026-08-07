import { defineSubagent, useTool } from '@flue/runtime';
import { TIERS } from '../shared/models.ts';
import { getRepoPath } from '../shared/run-context.ts';
import { createGhQueryTool } from '../tools/repo-tools.ts';
import instructions from './researcher.md';

/**
 * Generic deep source-research specialist, shared across document kinds. Runs
 * read-only over the library checkout in the parent's sandbox (glob/grep/read
 * via built-in shell), plus `gh_query` for GitHub history. The calling phase tool
 * supplies the kind-specific focus and result schema, so this role itself stays
 * document-kind-neutral. It does not write files.
 */
export function Researcher() {
  // getRepoPath is passed unresolved: this render runs after the writer's, but
  // the module is imported well before either.
  useTool(createGhQueryTool(getRepoPath));
  return instructions;
}

export const researcher = defineSubagent({
  name: 'researcher',
  ...TIERS.researcher,
  description:
    'Researches a ZIO topic across source, tests, examples, and GitHub history; returns structured research answers in the shape the caller requests.',
  agent: Researcher,
});
