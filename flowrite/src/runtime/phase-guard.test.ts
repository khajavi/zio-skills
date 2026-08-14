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

import { __resetPhaseMemoForTests, guardPhase, guardRootOnly, memoHits } from './phase-guard.ts';

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
  // Four DIFFERENT type names, because identical arguments now collapse into one call — see the memo
  // tests below. Distinct arguments are distinct work and must all run.
  __resetPhaseMemoForTests();
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

test('a repeat with the same arguments returns the first result without redoing the work', async () => {
  // turn9's waste: the model fired a phase batch, this guard refused the calls that looked nested,
  // and the model re-fired the WHOLE batch — so research_data_type ran 8 times for 4 types and the
  // run cost $3.30 against turn5's $2.17. Memoizing makes the repeat free instead of forbidden, so
  // the model's recovery stops being expensive.
  __resetPhaseMemoForTests();
  let ran = 0;
  const phase = guardPhase(
    fakeTool('research_data_type', async () => {
      ran += 1;
      return { output: `research #${ran}` };
    }),
  );

  const first = await phase.run(ctxFor({ typeName: 'Iso' }));
  const second = await phase.run(ctxFor({ typeName: 'Iso' }));
  assert.equal(ran, 1, 'the work runs once');
  assert.deepEqual(second, first, 'the repeat returns exactly what the first call returned');
  assert.deepEqual(memoHits(), { research_data_type: 1 });
});

test('a duplicate inside the same batch waits for the first call rather than starting a second', async () => {
  // The promise is memoized, not the value — turn9's duplicates arrived concurrently, so a resolved
  // value would not have existed yet to return.
  __resetPhaseMemoForTests();
  let ran = 0;
  const phase = guardPhase(
    fakeTool('research_data_type', async () => {
      ran += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { output: ran };
    }),
  );

  const both = await Promise.all([phase.run(ctxFor({ typeName: 'Iso' })), phase.run(ctxFor({ typeName: 'Iso' }))]);
  assert.equal(ran, 1);
  assert.deepEqual(both[0], both[1]);
});

test('argument key order does not make a repeat look like new work', async () => {
  // The input is generated JSON, so two identical calls can serialize their keys in either order.
  __resetPhaseMemoForTests();
  let ran = 0;
  const phase = guardPhase(fakeTool('design_module_plan', async () => ({ output: ++ran })));

  await phase.run(ctxFor({ moduleName: 'optics', layoutOverride: 'hierarchical' }));
  await phase.run(ctxFor({ layoutOverride: 'hierarchical', moduleName: 'optics' }));
  assert.equal(ran, 1);
});

test('a failed phase is not memoized, so it stays retryable', async () => {
  // The whole problem in turn9 was a model unable to make progress after a refusal. A memoized
  // failure would make every retry return the same error forever.
  __resetPhaseMemoForTests();
  let attempts = 0;
  const phase = guardPhase(
    fakeTool('research_data_type', async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('the researcher gave up');
      return { output: 'second time lucky' };
    }),
  );

  await assert.rejects(async () => { await phase.run(ctxFor({ typeName: 'Iso' })); }, /gave up/);
  assert.deepEqual(await phase.run(ctxFor({ typeName: 'Iso' })), { output: 'second time lucky' });
  assert.equal(attempts, 2);
});

test('review is never memoized, because a second round must re-read a fixed page', async () => {
  // The bug an earlier MAX_REVIEW_CALLS=1 shipped: a page went out whose recorded verdict still named
  // a rule the writer had already fixed, because the second call returned the first verdict.
  __resetPhaseMemoForTests();
  let ran = 0;
  const phase = guardPhase(fakeTool('review_page', async () => ({ output: ++ran })));

  await phase.run(ctxFor({ path: 'docs/reference/prism.md' }));
  await phase.run(ctxFor({ path: 'docs/reference/prism.md' }));
  assert.equal(ran, 2, 'both rounds must really run');
  assert.deepEqual(memoHits(), {});
});

test('writing is never memoized, because a redraft arrives with the same plan and research', async () => {
  __resetPhaseMemoForTests();
  let ran = 0;
  const phase = guardPhase(fakeTool('write_data_type_reference', async () => ({ output: ++ran })));

  await phase.run(ctxFor({ researchAnswers: { typeName: 'Iso' } }));
  await phase.run(ctxFor({ researchAnswers: { typeName: 'Iso' } }));
  assert.equal(ran, 2, 'a redraft must produce a new draft, not the old page');
});
