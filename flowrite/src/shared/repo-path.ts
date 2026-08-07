/**
 * The library checkout every role reads from, set once by the writer agent's
 * render (from `useInitialData()`) before any delegation happens.
 *
 * Replaces the REPO_PATH env var. The env var existed because an agent's cwd was
 * resolved at agent-init time — before a workflow's run() body executed — so the
 * value had to be planted even earlier, by route middleware that cloned the
 * request to peek at its body (see the deleted docs-workflow.ts). Flue 2 removes
 * the hazard: the root render reads `initialData` directly and runs before every
 * subagent render, so a plain module holder is ordered correctly by construction.
 *
 * A subagent render cannot call `useInitialData()` (it returns undefined there),
 * which is why roles read this instead of the hook.
 */
let repoPath: string | undefined;

export function setRepoPath(path: string): void {
  repoPath = path;
}

export function getRepoPath(): string {
  if (!repoPath) {
    throw new Error(
      'Repo path is unset — the writer agent render must call setRepoPath(initialData.projectPath) first.',
    );
  }
  return repoPath;
}
