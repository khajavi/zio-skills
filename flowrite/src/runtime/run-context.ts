export type SkipPhase =
  | 'research'
  | 'design'
  | 'write'
  | 'write-examples'
  | 'fact-check'
  | 'integrate'
  | 'review';

/**
 * The kinds of document flowrite writes.
 *
 * Declared here rather than in the agent module because phase tools need the type and importing the
 * agent from a tool would close a cycle (agent → composition → run-context → agent). The agent
 * re-exports both for its own tests.
 */
export const DOC_KINDS = ['data-type', 'module', 'tutorial', 'how-to'] as const;
export type DocKind = (typeof DOC_KINDS)[number];

/** Per-run facts every phase needs, taken from the writer agent's `initialData`. */
export interface RunContext {
  /** Absolute path to the library checkout being documented. */
  projectPath: string;
  /**
   * Which kind of document this run writes, or null before the request has been classified.
   *
   * Published here because a phase tool cannot read it any other way: it lives in
   * `usePersistentState('docKind')`, and hooks are unreachable from a tool body — the same reason
   * `projectPath` and `skipPhases` travel through this object. It is what lets one review tool serve
   * every kind instead of one tool per kind differing only in which checklist they paste.
   */
  kind: DocKind | null;
  /**
   * The requester's own words — the message that started the run, e.g. "Please write reference
   * documentation for the Chunk data type".
   *
   * Replaces the optional `userPrompt` creation-data field: the request IS the input now, so this
   * is always populated once the run is classified (empty only during the classification turn,
   * before any phase tool can run).
   */
  request: string;
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

/**
 * Every phase this run was asked to skip, for the instruction that tells the model about them.
 *
 * Every phase is a `task` delegation driven by instruction prose now — review and fact-check joined
 * research/design/write/integrate when `review_page` and `fact_check_page` (the last two code-gated
 * phase tools) were retired, so nothing in this module can refuse a call any more. A skip is entirely
 * the model's to honor, which is what this supplies to the instruction: see SHARED_DIRECTIVE in
 * composition.ts for where it reaches the model.
 */
export function skippedPhases(): readonly SkipPhase[] {
  return requireContext().skipPhases;
}

/**
 * Which kind of document this run writes.
 *
 * Throws rather than defaulting: a role that rendered before classification would silently review a
 * data type page against the tutorial checklist, and a wrong checklist is worse than a stopped run.
 * In practice it cannot happen — no role is reachable before `set_document_kind` publishes the kind —
 * so this guards a programming error, not a run.
 */
export function docKind(): DocKind {
  const kind = requireContext().kind;
  if (kind === null) {
    throw new Error(
      'The document kind is not set yet, so this phase ran before the request was classified. ' +
        'Call set_document_kind first.',
    );
  }
  return kind;
}

/**
 * The run's author hint, formatted for appending to a delegation prompt so it
 * reaches the role doing the real work — a phase prompt is built in code, so the
 * top-level agent's own prompt cannot forward it.
 */
export function authorHint(): string {
  const hint = current?.request?.trim();
  return hint ? `\nThe requester asked for this — treat it as a constraint for this task: ${hint}` : '';
}
