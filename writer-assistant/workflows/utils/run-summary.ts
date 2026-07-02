/**
 * Run summary tracker: aggregates token usage, real dollar cost, and wall-clock
 * time for a workflow run, broken down by phase and by model.
 *
 * Flue already returns `usage: PromptUsage` (token counts + cost computed from
 * the provider's pricing table) on every `session.prompt()`, `session.skill()`,
 * and `session.task()` call — workflows just discard it. This utility wraps the
 * harness so every session it hands out is tapped: the original CallHandle is
 * returned unchanged (`.abort()`/`.signal` intact) and usage is recorded when
 * the call resolves.
 *
 * Usage in a workflow's run function:
 *
 *   const tracker = createRunSummaryTracker(harness, { workflowName: 'my-workflow' });
 *   harness = tracker.harness;            // before the first harness.session(...)
 *   ...
 *   tracker.beginPhase('research');       // before each sequential phase
 *   ...
 *   const summary = tracker.finish();
 *   console.log(formatSummaryReport(summary));
 */

export interface UsageTotals {
  calls: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  costUsd: number;
}

export interface PhaseSummary extends UsageTotals {
  name: string;
  durationMs: number;
  /** Names of the sessions that ran LLM calls during this phase. */
  sessions: string[];
}

export interface RunSummary {
  workflow: string;
  startedAt: string;
  finishedAt: string;
  wallClockMs: number;
  totals: UsageTotals;
  /** In beginPhase order; calls before the first marker land in "(unattributed)". */
  phases: PhaseSummary[];
  /** Keyed by `${provider}/${modelId}`. */
  models: Record<string, UsageTotals>;
}

export interface RunSummaryTracker {
  /** Wrapped harness — pass this to sessions and phase helpers in place of the original. */
  harness: any;
  /** Wrap a session obtained outside the wrapped harness. */
  wrapSession(session: any): any;
  /** Mark the start of a sequential phase; ends the previous one. */
  beginPhase(name: string): void;
  /** Freeze the clock and return the summary. Idempotent. */
  finish(): RunSummary;
}

const UNATTRIBUTED = '(unattributed)';
const TAPPED_METHODS = new Set(['prompt', 'skill', 'task']);

interface PhaseBucket {
  name: string;
  startMs: number;
  endMs: number | null;
  totals: UsageTotals;
  sessions: Set<string>;
}

function emptyTotals(): UsageTotals {
  return { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, costUsd: 0 };
}

function addUsage(totals: UsageTotals, usage: any): void {
  totals.calls += 1;
  totals.input += usage?.input ?? 0;
  totals.output += usage?.output ?? 0;
  totals.cacheRead += usage?.cacheRead ?? 0;
  totals.cacheWrite += usage?.cacheWrite ?? 0;
  totals.totalTokens += usage?.totalTokens ?? 0;
  totals.costUsd += usage?.cost?.total ?? 0;
}

export function createRunSummaryTracker(
  harness: any,
  opts: { workflowName?: string } = {}
): RunSummaryTracker {
  const startedMs = Date.now();
  const totals = emptyTotals();
  const models: Record<string, UsageTotals> = {};
  const phases: PhaseBucket[] = [];
  let currentPhase: PhaseBucket | null = null;
  let finished: RunSummary | null = null;

  function beginPhase(name: string): void {
    const now = Date.now();
    if (currentPhase && currentPhase.endMs === null) currentPhase.endMs = now;
    currentPhase = {
      name,
      startMs: now,
      endMs: null,
      totals: emptyTotals(),
      sessions: new Set<string>(),
    };
    phases.push(currentPhase);
  }

  function currentBucket(): PhaseBucket {
    if (!currentPhase) beginPhase(UNATTRIBUTED);
    return currentPhase!;
  }

  function record(bucket: PhaseBucket, sessionName: string, usage: any, model: any): void {
    if (!usage) return;
    addUsage(totals, usage);
    addUsage(bucket.totals, usage);
    bucket.sessions.add(sessionName);
    const modelKey = model?.provider && model?.id ? `${model.provider}/${model.id}` : '(unknown)';
    addUsage((models[modelKey] ??= emptyTotals()), usage);
  }

  const wrappedSessions = new WeakMap<object, any>();

  function wrapSession(session: any): any {
    if (session === null || typeof session !== 'object') return session;
    const existing = wrappedSessions.get(session);
    if (existing) return existing;
    const proxy = new Proxy(session, {
      get(target, prop) {
        if (typeof prop === 'string' && TAPPED_METHODS.has(prop)) {
          return (...args: any[]) => {
            // Attribute to the phase active at invocation time, even if the
            // call resolves after the workflow has moved to the next phase.
            const bucket = currentBucket();
            const handle = target[prop](...args);
            handle.then(
              (res: any) => record(bucket, target.name ?? '(unnamed)', res?.usage, res?.model),
              () => {} // caller's own await still observes the rejection
            );
            return handle;
          };
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    wrappedSessions.set(session, proxy);
    return proxy;
  }

  const wrappedHarness = new Proxy(harness, {
    get(target, prop) {
      if (prop === 'session') {
        return async (...args: any[]) => wrapSession(await target.session(...args));
      }
      if (prop === 'sessions') {
        const sessions = target.sessions;
        return {
          get: async (...args: any[]) => wrapSession(await sessions.get(...args)),
          create: async (...args: any[]) => wrapSession(await sessions.create(...args)),
        };
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

  function finish(): RunSummary {
    if (finished) return finished;
    const endMs = Date.now();
    if (currentPhase && currentPhase.endMs === null) currentPhase.endMs = endMs;
    finished = {
      workflow: opts.workflowName ?? harness?.name ?? 'workflow',
      startedAt: new Date(startedMs).toISOString(),
      finishedAt: new Date(endMs).toISOString(),
      wallClockMs: endMs - startedMs,
      totals,
      phases: phases.map((bucket) => ({
        name: bucket.name,
        durationMs: (bucket.endMs ?? endMs) - bucket.startMs,
        sessions: [...bucket.sessions],
        ...bucket.totals,
      })),
      models,
    };
    return finished;
  }

  return { harness: wrappedHarness, wrapSession, beginPhase, finish };
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function formatCost(costUsd: number): string {
  if (costUsd > 0 && costUsd < 0.01) return `$${costUsd.toFixed(4)}`;
  return `$${costUsd.toFixed(2)}`;
}

export function formatSummaryReport(summary: RunSummary): string {
  const rule = '─'.repeat(78);
  const columns = [14, 10, 7, 11, 11, 13, 8];
  const row = (cells: string[]) =>
    cells
      .map((cell, i) => cell.padEnd(columns[i] ?? 0))
      .join(' ')
      .trimEnd();

  const usageRow = (label: string, durationMs: number, u: UsageTotals) =>
    row([
      label,
      formatDuration(durationMs),
      String(u.calls),
      formatCount(u.input),
      formatCount(u.output),
      `${formatCompact(u.cacheRead)} / ${formatCompact(u.cacheWrite)}`,
      formatCost(u.costUsd),
    ]);

  const lines: string[] = [
    rule,
    `Run summary: ${summary.workflow}`,
    `Wall clock: ${formatDuration(summary.wallClockMs)}   (${summary.startedAt} → ${summary.finishedAt})`,
    '',
    row(['Phase', 'Time', 'Calls', 'In tok', 'Out tok', 'Cache r/w', 'Cost']),
    ...summary.phases.map((phase) => usageRow(phase.name, phase.durationMs, phase)),
    rule,
    usageRow('TOTAL', summary.wallClockMs, summary.totals),
    '',
    ...Object.entries(summary.models).map(
      ([model, u]) =>
        `Model: ${model} — ${u.calls} call(s), ${formatCount(u.totalTokens)} tokens, ${formatCost(u.costUsd)}`
    ),
    rule,
  ];
  return lines.join('\n');
}
