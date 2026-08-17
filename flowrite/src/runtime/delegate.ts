import type { FlueHarness, FlueLogger } from '@flue/runtime';
import type * as v from 'valibot';
import { note } from './log.ts';

// "conversation stream contract": a corrupted subagent conversation record
// mid-task; a fresh attempt starts clean.
//
// "request timed out" / "stream idle" cover a provider stream that goes silent.
// The runtime classes that as a transient provider error and retries the turn under
// its own error budget, but the phrasing matched none of the patterns below, so a
// stalled delegation failed the whole phase instead of being retried once.
const TRANSIENT =
  /connection error|econnreset|etimedout|fetch failed|socket hang up|conversation stream contract|request timed out|stream idle/i;

/**
 * A delegate that finished without producing schema-valid data.
 *
 * `harness.prompt` rejects with `ResultUnavailableError` "when the model gives up or exhausts its
 * follow-up attempts" (reference/agent-api.md), which the calling agent then sees as the tool error
 * `The agent gave up: …`. Distinct from TRANSIENT: nothing dropped, the delegation ran to completion
 * and produced prose where a `finish` call was required.
 */
const GAVE_UP = /gave up|result ?unavailable|no structured answer/i;

/**
 * A harness prompt has no durable retry (see concepts/durable-execution: "not
 * recovered this way"), so one transient provider drop would fail the whole
 * phase. Retry transient transport errors a couple of times; rethrow everything
 * else.
 */
export async function withTransientRetry<T>(log: FlueLogger, label: string, op: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await op();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt >= 3 || !TRANSIENT.test(message)) throw error;
      note(log, `${label} failed with transient error (attempt ${attempt}/3), retrying: ${message}`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 5_000));
    }
  }
}

/**
 * Delegate one phase to a named role and return its schema-validated result.
 *
 * The harness runs a scratch conversation — separate from the agent's public one, fresh per tool call —
 * that reaches the agent's declared subagents through the `task` tool. So the role is selected by
 * instruction rather than by parameter, and the lead-in below is what makes the scratch conversation
 * delegate instead of answering by itself.
 *
 * `result` keeps its validate-and-re-ask behaviour, with one change worth knowing:
 * a rejection surfaces to the CALLING agent as a tool error rather than making the
 * delegate re-emit, so the whole phase re-runs and the parent decides whether to
 * retry (it gives up after roughly two attempts). Guard messages therefore have to
 * read as instructions the model can act on — they are the retry prompt now.
 */
export async function delegate<S extends v.GenericSchema>(opts: {
  harness: FlueHarness;
  log: FlueLogger;
  /** Log label, e.g. 'researcher (data type)'. */
  label: string;
  /** Catalog name of the declared subagent, e.g. 'researcher'. */
  role: string;
  prompt: string;
  result: S;
}): Promise<v.InferOutput<S>> {
  const { harness, log, label, role, prompt, result } = opts;
  const ask = (text: string) => withTransientRetry(log, label, () => harness.prompt(text, { result }));

  try {
    const { data } = await ask(
      `Delegate the task below to the "${role}" subagent using the task tool. ` +
        `Do not carry it out yourself, and pass the task through verbatim.\n\n${prompt}`,
    );
    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!GAVE_UP.test(message)) throw error;

    // ONE retry, and no backoff: a delegate that answered in prose is not waiting on a resource, so
    // sleeping changes nothing. One rather than TRANSIENT's three because an attempt here is a whole
    // delegation — turn5's research give-up burned 141s — and a task that is genuinely impossible
    // would burn that twice before failing anyway.
    //
    // The retry does not repeat the task. Repeated `harness.prompt` calls continue the same scratch
    // conversation (reference/agent-api.md), so the prompt above and the failure are both still in
    // context; re-sending the whole task would duplicate a payload the conversation already holds.
    // What was missing was the `finish` call, so that is what this asks for.
    note(log, `${label} gave up without a schema-valid result, retrying once: ${message}`);
    const { data } = await ask(
      `The "${role}" subagent did not return data matching the required schema. Delegate the SAME ` +
        `task to it again with the task tool, and tell it to end with a single finish call whose ` +
        `arguments match the schema exactly — prose does not count. Do not carry out the task yourself.`,
    );
    return data;
  }
}
