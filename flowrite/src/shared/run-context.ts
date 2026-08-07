export type SkipPhase = 'research' | 'design' | 'write' | 'write-examples' | 'integrate' | 'review';

/** Per-run facts every phase needs, taken from the writer agent's `initialData`. */
export interface RunContext {
  /** Absolute path to the library checkout being documented. */
  projectPath: string;
  /** Optional free-form hint steering this run. */
  userPrompt?: string | undefined;
  /** Code-gated phases to skip, for resuming a run whose artifacts exist. */
  skipPhases: readonly SkipPhase[];
}

/**
 * The current run's context, set once by the writer agent's render.
 *
 * Replaces the REPO_PATH / SKIP_PHASES / USER_PROMPT environment channel. Those
 * env vars existed because an agent's cwd was resolved at agent-init time —
 * before a workflow's run() body executed — so the values had to be planted even
 * earlier, by route middleware that cloned the request to peek at its body (see
 * the deleted docs-workflow.ts). Flue 2 removes the hazard: the root render reads
 * `initialData` directly and runs before every phase tool and subagent render, so
 * a plain module holder is correctly ordered by construction.
 *
 * A module holder rather than a hook because the readers are phase-tool bodies and
 * subagent renders, neither of which can reach the root agent's `useInitialData()`
 * (it returns undefined in a subagent render). One process per run — run-*.sh
 * execs a fresh node process each time — so a single mutable slot is safe; this
 * would need a real per-run key to serve concurrent runs in one process.
 */
let current: RunContext | undefined;

export function setRunContext(context: RunContext): void {
  current = context;
}

function requireContext(): RunContext {
  if (!current) {
    throw new Error(
      'Run context is unset — the writer agent render must call setRunContext(...) from useInitialData() first.',
    );
  }
  return current;
}

export function getRepoPath(): string {
  return requireContext().projectPath;
}

/** True when this code-gated phase was skipped for the current run. */
export function isPhaseSkipped(phase: SkipPhase): boolean {
  return requireContext().skipPhases.includes(phase);
}

/**
 * The run's author hint, formatted for appending to a delegation prompt so it
 * reaches the role doing the real work — a phase prompt is built in code, so the
 * top-level agent's own prompt cannot forward it.
 */
export function authorHint(): string {
  const hint = current?.userPrompt?.trim();
  return hint ? `\nAuthor hint from the user — treat as a constraint for this task: ${hint}` : '';
}
