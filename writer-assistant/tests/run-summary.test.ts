import { describe, it, expect, vi } from 'vitest';
import {
  createRunSummaryTracker,
  formatSummaryReport,
  type RunSummary,
} from '../workflows/utils/run-summary';

const USAGE = {
  input: 100,
  output: 50,
  cacheRead: 1000,
  cacheWrite: 200,
  totalTokens: 1350,
  cost: { input: 0.1, output: 0.2, cacheRead: 0.01, cacheWrite: 0.02, total: 0.33 },
};

const MODEL = { provider: 'anthropic', id: 'claude-sonnet-5' };

interface FakeHandle<T> extends Promise<T> {
  signal: AbortSignal;
  abort: () => void;
}

function fakeHandle<T>(value: T | Promise<T>): FakeHandle<T> {
  const controller = new AbortController();
  return Object.assign(Promise.resolve(value), {
    signal: controller.signal,
    abort: vi.fn(),
  }) as FakeHandle<T>;
}

function fakeRejectedHandle(error: Error): FakeHandle<never> {
  const controller = new AbortController();
  const promise = Promise.reject(error);
  return Object.assign(promise, {
    signal: controller.signal,
    abort: vi.fn(),
  }) as FakeHandle<never>;
}

function fakeSession(name: string, response: any = { text: 'ok', usage: USAGE, model: MODEL }) {
  return {
    name,
    conversationId: `conv-${name}`,
    prompt: vi.fn(() => fakeHandle(response)),
    task: vi.fn(() => fakeHandle(response)),
    skill: vi.fn(() => fakeHandle(response)),
    compact: vi.fn(function (this: any) {
      return this;
    }),
    fs: {},
  };
}

function fakeHarness(sessions: Record<string, any> = {}) {
  return {
    name: 'test-harness',
    session: vi.fn(async (name: string = 'default') => {
      sessions[name] ??= fakeSession(name);
      return sessions[name];
    }),
    sessions: {
      get: vi.fn(async (name: string = 'default') => sessions[name]),
      create: vi.fn(async (name: string = 'default') => {
        sessions[name] = fakeSession(name);
        return sessions[name];
      }),
    },
    shell: vi.fn(),
    fs: {},
  };
}

describe('createRunSummaryTracker', () => {
  it('accumulates totals across prompt/task/skill from multiple sessions', async () => {
    const tracker = createRunSummaryTracker(fakeHarness(), { workflowName: 'wf' });
    tracker.beginPhase('research');

    const a = await tracker.harness.session('a');
    const b = await tracker.harness.session('b');
    await a.prompt('one');
    await a.task('two', { agent: 'sub' });
    await b.skill('some-skill');

    const summary = tracker.finish();
    expect(summary.totals.calls).toBe(3);
    expect(summary.totals.input).toBe(300);
    expect(summary.totals.output).toBe(150);
    expect(summary.totals.totalTokens).toBe(4050);
    expect(summary.totals.costUsd).toBeCloseTo(0.99);
    expect(summary.models['anthropic/claude-sonnet-5'].calls).toBe(3);
  });

  it('attributes calls to the phase active at invocation time', async () => {
    let resolveLate!: (v: any) => void;
    const late = new Promise((resolve) => (resolveLate = resolve));
    const slowSession = fakeSession('slow');
    slowSession.prompt = vi.fn(() => fakeHandle(late));

    const tracker = createRunSummaryTracker(fakeHarness({ slow: slowSession }));
    tracker.beginPhase('a');
    const session = await tracker.harness.session('slow');
    const pending = session.prompt('invoked in a');

    tracker.beginPhase('b');
    resolveLate({ text: 'done', usage: USAGE, model: MODEL });
    await pending;

    const summary = tracker.finish();
    const phaseA = summary.phases.find((p) => p.name === 'a')!;
    const phaseB = summary.phases.find((p) => p.name === 'b')!;
    expect(phaseA.calls).toBe(1);
    expect(phaseB.calls).toBe(0);
    expect(phaseA.sessions).toEqual(['slow']);
  });

  it('buckets calls before the first beginPhase as unattributed', async () => {
    const tracker = createRunSummaryTracker(fakeHarness());
    const session = await tracker.harness.session('early');
    await session.prompt('no phase yet');

    const summary = tracker.finish();
    expect(summary.phases[0].name).toBe('(unattributed)');
    expect(summary.phases[0].calls).toBe(1);
  });

  it('records structured-result responses ({data, usage, model}) like freeform ones', async () => {
    const structured = fakeSession('structured', {
      data: { ok: true },
      usage: USAGE,
      model: MODEL,
    });
    const tracker = createRunSummaryTracker(fakeHarness({ structured }));
    tracker.beginPhase('verify');

    const session = await tracker.harness.session('structured');
    await session.prompt('give me data', { result: {} });

    const summary = tracker.finish();
    expect(summary.totals.calls).toBe(1);
    expect(summary.totals.costUsd).toBeCloseTo(0.33);
  });

  it('returns the original CallHandle and forwards arguments verbatim', async () => {
    const raw = fakeSession('raw');
    const tracker = createRunSummaryTracker(fakeHarness({ raw }));
    tracker.beginPhase('write');

    const session = await tracker.harness.session('raw');
    const options = { maxTurns: 3 };
    const handle = session.prompt('hello', options);

    expect(raw.prompt).toHaveBeenCalledWith('hello', options);
    expect(typeof handle.abort).toBe('function');
    expect(handle.signal).toBeInstanceOf(AbortSignal);
    await handle;

    expect(session.name).toBe('raw');
    expect(session.conversationId).toBe('conv-raw');
    expect(session.compact()).toBe(raw); // non-tapped methods dispatch with original `this`
  });

  it('does not record rejected calls and re-surfaces the rejection to the caller', async () => {
    const failing = fakeSession('failing');
    failing.prompt = vi.fn(() => fakeRejectedHandle(new Error('boom')));
    const tracker = createRunSummaryTracker(fakeHarness({ failing }));
    tracker.beginPhase('write');

    const session = await tracker.harness.session('failing');
    await expect(session.prompt('will fail')).rejects.toThrow('boom');

    const summary = tracker.finish();
    expect(summary.totals.calls).toBe(0);
  });

  it('wraps sessions obtained via harness.sessions.get/create', async () => {
    const sessions: Record<string, any> = {};
    const tracker = createRunSummaryTracker(fakeHarness(sessions));
    tracker.beginPhase('review');

    const created = await tracker.harness.sessions.create('reviewer');
    await created.prompt('review it');
    const fetched = await tracker.harness.sessions.get('reviewer');
    await fetched.prompt('again');

    const summary = tracker.finish();
    expect(summary.totals.calls).toBe(2);
    expect(summary.phases[0].sessions).toEqual(['reviewer']);
  });

  it('finish() is idempotent and durations are consistent', async () => {
    const tracker = createRunSummaryTracker(fakeHarness(), { workflowName: 'wf' });
    tracker.beginPhase('only');
    const session = await tracker.harness.session();
    await session.prompt('x');

    const first = tracker.finish();
    const second = tracker.finish();
    expect(second).toBe(first);
    expect(first.wallClockMs).toBeGreaterThanOrEqual(0);
    for (const phase of first.phases) {
      expect(phase.durationMs).toBeGreaterThanOrEqual(0);
      expect(phase.durationMs).toBeLessThanOrEqual(first.wallClockMs);
    }
  });
});

describe('formatSummaryReport', () => {
  it('renders phases, totals, and cost', () => {
    const totals = {
      calls: 3,
      input: 91203,
      output: 52610,
      cacheRead: 410000,
      cacheWrite: 61000,
      totalTokens: 614813,
      costUsd: 2.31,
    };
    const summary: RunSummary = {
      workflow: 'docs-write-tutorial',
      startedAt: '2026-07-02T10:00:00.000Z',
      finishedAt: '2026-07-02T10:24:12.000Z',
      wallClockMs: 1_452_000,
      totals,
      phases: [
        {
          name: 'research',
          durationMs: 220_000,
          sessions: ['docs-write-tutorial'],
          calls: 1,
          input: 12345,
          output: 8900,
          cacheRead: 45000,
          cacheWrite: 12000,
          totalTokens: 78245,
          costUsd: 0.31,
        },
      ],
      models: { 'anthropic/claude-sonnet-5': totals },
    };

    const report = formatSummaryReport(summary);
    expect(report).toContain('Run summary: docs-write-tutorial');
    expect(report).toContain('Wall clock: 24m 12s');
    expect(report).toContain('research');
    expect(report).toContain('TOTAL');
    expect(report).toContain('$2.31');
    expect(report).toContain('anthropic/claude-sonnet-5');
  });
});
