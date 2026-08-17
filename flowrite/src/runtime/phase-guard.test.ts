// Regression tests for the two guards. Node's built-in runner, no dependencies — `npm test`.
//
// These exist because the guards are pure interposition: nothing downstream fails if a wrapper
// silently stops working. An earlier attempt at cost attribution in this repo typechecked, ran,
// and did nothing for weeks (it keyed on `event.harness`, which is the harness's own name), so a
// guard verified only by `tsc` is not verified. Every assertion below corresponds to a behaviour
// that was observed breaking in a real run.
import assert from 'node:assert/strict';
import test from 'node:test';
import type { ToolDefinition } from '@flue/runtime';

import { guardPhase, guardRootOnly } from './phase-guard.ts';

/** A stand-in tool. The guards only read `name` and `run`, so the rest of the shape is irrelevant. */
const fakeTool = (name: string, run: ToolDefinition['run']) => ({ name, run }) as ToolDefinition;

/**
 * A tool whose body calls another tool and discards its result.
 *
 * The discard has to be explicit: `run` may return a value or nothing, but never
 * `Promise<void>`, so `async () => inner.run(ctx)` does not typecheck. That asymmetry is the same
 * one `normalize` handles inside the guards.
 */
const callerOf = (name: string, inner: () => unknown) =>
  fakeTool(name, async () => {
    await inner();
    return { output: 'not reached — the guard refuses first' };
  });

const ctx = {} as Parameters<ToolDefinition['run']>[0];

/** A context carrying tool input, for the memo — which keys on the arguments a call was made with. */
const ctxFor = (data: unknown) =>
  ({ data, log: { info: () => {}, warn: () => {}, error: () => {} } }) as unknown as Parameters<
    ToolDefinition['run']
  >[0];

const okTool = (name: string, onRun?: () => void) =>
  fakeTool(name, async () => {
    onRun?.();
    return { output: name };
  });

test('a run-terminal tool is allowed at the root', async () => {
  const report = guardRootOnly(okTool('report_run_result'));
  assert.deepEqual(await report.run(ctx), { output: 'report_run_result' });
});

test('a run-terminal tool is refused inside a phase', async () => {
  // The real failure: review_data_type_ref filed the run's verdict 40 minutes before its own
  // review finished, because every phase inherits SHARED_DIRECTIVE's "call report_run_result".
  const report = guardRootOnly(okTool('report_run_result'));
  const phase = guardPhase(callerOf('review_data_type_ref', () => report.run(ctx)));

  // Each thunk is `async` so it is a `() => Promise<unknown>`: a ToolDefinition's `run` may
  // legally return synchronously, so its bare call signature does not satisfy assert.rejects.
  await assert.rejects(async () => { await phase.run(ctx); }, (err: Error) => {
    assert.match(err.message, /"report_run_result" cannot run inside the "review_data_type_ref"/);
    // Must tell the caller to return its result, NOT to delegate — delegating a report would
    // relocate the same mistake into a subagent.
    assert.match(err.message, /let the writer report/);
    return true;
  });
});

test('a run-terminal tool opens no phase frame', async () => {
  // If the report opened a frame, a phase call landing in the same async context afterwards would
  // read it and be refused as nested.
  const report = guardRootOnly(okTool('report_run_result'));
  const phase = guardPhase(okTool('research_data_type'));

  await report.run(ctx);
  assert.deepEqual(await phase.run(ctx), { output: 'research_data_type' });
});

test('a phase is refused inside another phase', async () => {
  const inner = guardPhase(okTool('integrate_data_type_reference'));
  const outer = guardPhase(callerOf('review_data_type_ref', () => inner.run(ctx)));

  await assert.rejects(async () => { await outer.run(ctx); }, /cannot run inside the "review_data_type_ref"/);
});

test('a phase is refused inside itself', async () => {
  // Seen in a real run — `review_data_type_ref` inside `review_data_type_ref`. Never intentional.
  const self: ToolDefinition = guardPhase(callerOf('review_data_type_ref', () => self.run(ctx)));

  await assert.rejects(async () => { await self.run(ctx); }, /cannot run inside the "review_data_type_ref"/);
});

test('concurrent phase calls from the root are all allowed', async () => {
  // The reason the guard uses AsyncLocalStorage and not a boolean flag: the model legitimately
  // issues several phase tools in one turn (four concurrent research_data_type calls in a real
  // module run). A flag would refuse three of them and break the hierarchical layout.
  //
  // Four DIFFERENT type names, because that is the real shape: distinct arguments are distinct work
  // and must all run.
  let ran = 0;
  const phase = guardPhase(
    fakeTool('research_data_type', async () => {
      ran += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { output: ran };
    }),
  );

  const results = await Promise.all(
    ['Iso', 'Lens', 'Prism', 'Optional'].map((typeName) => phase.run(ctxFor({ typeName }))),
  );
  assert.equal(results.length, 4);
  assert.equal(ran, 4);
});

/*
 * The memo tests that stood here are gone with the memo (see phase-guard.ts).
 *
 * They pinned real behaviour — a repeat returning the first result, a duplicate inside one batch
 * awaiting the first call rather than starting a second, key order not making a repeat look like new
 * work, a failure staying retryable, and review and write never collapsing. All of it only reachable
 * through a phase-tool wrapper, and there is one phase tool left. `task` delegations are not deduped by
 * anything, so duplicate research is possible again; run-telemetry's perTypePairing is what notices.
 */
