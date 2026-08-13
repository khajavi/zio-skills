export type SkipPhase = 'research' | 'design' | 'write' | 'write-examples' | 'integrate' | 'review';

/**
 * The kinds of document flowrite writes.
 *
 * Declared here rather than in the agent module because phase tools need the type and importing the
 * agent from a tool would close a cycle (agent → composition → run-context → agent). The agent
 * re-exports both for its own tests.
 */
export const DOC_KINDS = ['data-type', 'module', 'tutorial'] as const;
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
   * all three kinds instead of three tools differing only in which checklist they paste.
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

/** True when this code-gated phase was skipped for the current run. */
export function isPhaseSkipped(phase: SkipPhase): boolean {
  return requireContext().skipPhases.includes(phase);
}

/**
 * Which kind of document this run writes.
 *
 * Throws rather than defaulting: a phase tool that ran before classification would silently review a
 * data type page against the tutorial checklist, and a wrong checklist is worse than a stopped run.
 * In practice it cannot happen — the phase tools are only mounted once the kind is set — so this
 * guards a programming error, not a run.
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
 * How many times the review phase may run for one page. Default 1, `MAX_REVIEW_ROUNDS` to raise it.
 *
 * A cap exists because a review round is the most expensive thing a run does, and it is expensive
 * *repeatedly*: the simple LLM review re-judges the whole page against the whole checklist and all 28
 * style rules every time, so round 4 costs what round 1 cost. Measured on the Prism run of
 * 2026-08-12: four rounds took 1,082s of a 45-minute run — 40% of the wall clock — with per-round
 * times of 242s, 344s, 239s and 256s that showed no sign of converging. Each round also drags a fix
 * pass and another sbt/mdoc verify behind it, so rounds multiply rather than add.
 *
 * The cost of the default: with one round, the writer's fixes ship UNVERIFIED. That is a real
 * trade-off, not a free win. An earlier cap of 1 (`MAX_REVIEW_CALLS`) produced a measured bug — a page
 * shipped whose verdict still named a rule the writer had already fixed — though that specific failure
 * came from returning a cached verdict, and nothing caches one now.
 *
 * Read from the environment rather than creation data because it is a cost knob for whoever launches
 * the run, like the model tiers in models.ts, not a fact about the document being written.
 */
export function maxReviewRounds(): number {
  const raw = Number(process.env.MAX_REVIEW_ROUNDS);
  return Number.isInteger(raw) && raw > 0 ? raw : 1;
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
