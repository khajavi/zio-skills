import { defineSubagent, useTool } from '@flue/runtime';
import { TIERS } from '../runtime/models.ts';
import { getRepoPath } from '../runtime/run-context.ts';
import { createGhQueryTool, createGhThreadTool, createGitHistoryTool } from '../tools/repo-tools.ts';
import instructions from './researcher.md';

/**
 * Generic deep source-research specialist, shared across document kinds. Runs
 * read-only over the library checkout in the parent's sandbox (glob/grep/read
 * via built-in shell), plus three history tools. The calling phase tool
 * supplies the kind-specific focus and result schema, so this role itself stays
 * document-kind-neutral. It does not write files.
 *
 * The history tools are three steps of one path, not three alternatives:
 * `git_history` reads what was said about the files just read, `gh_thread` opens
 * the PR or issue a commit names, and `gh_query` finds threads no commit named.
 * Only this role gets them — the root author has no use for history, and the
 * research phase is where rationale has somewhere to land (`designRationale`).
 */
export function Researcher() {
  // getRepoPath is passed unresolved: this render runs after the writer's, but
  // the module is imported well before either.
  useTool(createGitHistoryTool(getRepoPath));
  useTool(createGhThreadTool(getRepoPath));
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
