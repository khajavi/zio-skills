// Delegation retries.
//
// Two failure classes reach delegate(), and they need opposite policies. A transient transport drop is
// worth several attempts with backoff, because something is temporarily unavailable. A delegate that
// gave up ran to completion and answered in prose — nothing to wait for, and each attempt costs a whole
// delegation (turn5's research give-up burned 141s), so it gets exactly one.
//
// Worth testing because the give-up path is the one that used to fail a phase outright, and turn5 shows
// what the model does with a failed phase: it supplies the missing value itself.
import assert from 'node:assert/strict';
import test from 'node:test';
import * as v from 'valibot';

import { delegate } from './delegate.ts';

const silent = { info: () => {}, warn: () => {}, error: () => {} };
const result = v.object({ answer: v.string() });

/**
 * A harness whose `prompt` replays a scripted sequence of outcomes.
 *
 * Each entry is either the data to resolve with or an Error to reject with. Records every prompt it
 * received, which is what the assertions about the retry's wording read.
 */
function fakeHarness(outcomes: (Error | { answer: string })[]) {
  const prompts: string[] = [];
  let call = 0;
  return {
    prompts,
    get calls() {
      return call;
    },
    harness: {
      prompt(text: string) {
        prompts.push(text);
        const outcome = outcomes[call++];
        if (outcome === undefined) throw new Error(`unscripted prompt #${call}`);
        return outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve({ data: outcome });
      },
    } as never,
  };
}

test('a delegation that succeeds first time makes one call', async () => {
  const h = fakeHarness([{ answer: 'ok' }]);
  const data = await delegate({
    harness: h.harness,
    log: silent,
    label: 'researcher (data type)',
    role: 'researcher',
    prompt: 'Research Iso',
    result,
  });
  assert.deepEqual(data, { answer: 'ok' });
  assert.equal(h.calls, 1);
});

test('a give-up is retried once and can succeed', async () => {
  // turn5's exact error text, as the calling agent saw it.
  const h = fakeHarness([
    new Error('The agent gave up: The researcher subagent task completed but returned no structured answer.'),
    { answer: 'ok' },
  ]);
  const data = await delegate({
    harness: h.harness,
    log: silent,
    label: 'researcher (data type)',
    role: 'researcher',
    prompt: 'Research Iso',
    result,
  });
  assert.deepEqual(data, { answer: 'ok' });
  assert.equal(h.calls, 2, 'exactly one retry');
});

test('the retry asks for the finish call rather than repeating the task', async () => {
  // Repeated harness.prompt calls continue the same scratch conversation, so the task and the failure
  // are both still in context. Re-sending the task would duplicate a payload the conversation holds —
  // and what was missing was the finish call.
  const h = fakeHarness([new Error('The agent gave up: no structured answer'), { answer: 'ok' }]);
  await delegate({
    harness: h.harness,
    log: silent,
    label: 'researcher (data type)',
    role: 'researcher',
    prompt: 'RESEARCH-PAYLOAD-MARKER',
    result,
  });
  assert.match(h.prompts[0]!, /RESEARCH-PAYLOAD-MARKER/);
  assert.doesNotMatch(h.prompts[1]!, /RESEARCH-PAYLOAD-MARKER/, 'the task must not be re-sent');
  assert.match(h.prompts[1]!, /finish call/);
  assert.match(h.prompts[1]!, /Do not carry out the task yourself/);
});

test('a second give-up fails the phase rather than looping', async () => {
  const gaveUp = new Error('The agent gave up: no structured answer');
  const h = fakeHarness([gaveUp, gaveUp]);
  await assert.rejects(
    delegate({
      harness: h.harness,
      log: silent,
      label: 'researcher (data type)',
      role: 'researcher',
      prompt: 'Research Iso',
      result,
    }),
    /gave up/,
  );
  assert.equal(h.calls, 2, 'no third attempt');
});

test('an error that is neither transient nor a give-up is not retried', async () => {
  // A schema the delegate can never satisfy, a guard refusal, a bug — retrying spends a delegation to
  // reach the same place.
  const h = fakeHarness([new Error('phase re-entry refused by the guard')]);
  await assert.rejects(
    delegate({
      harness: h.harness,
      log: silent,
      label: 'designer (data type)',
      role: 'designer',
      prompt: 'Design Iso',
      result,
    }),
    /phase re-entry refused/,
  );
  assert.equal(h.calls, 1);
});
