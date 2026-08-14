import { AsyncLocalStorage } from 'node:async_hooks';
import type { ToolDefinition } from '@flue/runtime';
import { note } from './log.ts';

/**
 * Stops a phase tool from running inside another phase.
 *
 * Flue gives a `harness: true` tool's scratch conversation the parent agent's ENTIRE tool
 * registry and its system prompt verbatim, and there is no way to scope either
 * (`OperationOptions.tools` is additive; `tools: []` was tested and changes nothing). So a phase
 * tool can call another phase tool, each nesting one delegation level, until the runtime's cap of
 * 4 trips. When that happened in a module-ref run, `reviewer` and `style_checker` became
 * unreachable and five pages shipped with no review while the agent reported success.
 * See withastro/flue#561.
 *
 * Re-entry is not caused by instruction wording — that was tested directly and rewording made it
 * worse. The model re-enters when it cannot make progress: stuck, it falls back to the only thing
 * its inherited instructions describe, the whole pipeline. That is unfixable from the prompt side,
 * hence a guard.
 *
 * `AsyncLocalStorage` rather than a boolean flag, and this is the part that matters: the model
 * legitimately issues several phase tools in ONE turn from the root agent (four concurrent
 * `research_data_type` calls in a real run). Those are siblings, not nesting. A flag would refuse
 * three of them and break the hierarchical layout. ALS tells them apart — a nested call inherits
 * the frame, a concurrent root call starts empty. Verified in a clean-room repro, including that
 * ALS does propagate across the `harness.prompt()` boundary.
 */
const activePhase = new AsyncLocalStorage<string>();

/**
 * Refuse a call, loudly.
 *
 * Logged because refusals are the only direct evidence a guard is working: counting
 * `Maximum delegation depth` errors does NOT measure re-entry — nesting only errors if it happens
 * to reach depth 4, and repro runs nested with zero errors. stderr, never stdout: stdout carries
 * the reply and `--json` must stay parseable.
 *
 * Thrown, not returned: the runtime surfaces a thrown error as a tool error, which the calling
 * model reads as an instruction. Measured behaviour is that it then reaches the goal another way
 * rather than looping.
 */
const refusals: { tool: string; parent: string }[] = [];

/**
 * Every re-entry this guard blocked. Empty is the expected case.
 *
 * Collected because a refusal is not a runtime event, so the end-of-run report cannot observe it —
 * and counting `Maximum delegation depth` errors is not a substitute: nesting only errors if it
 * happens to reach depth 4, and measured runs nested with zero such errors.
 */
export function guardRefusals(): readonly { tool: string; parent: string }[] {
  return refusals;
}

function refuse(name: string, parent: string, advice: string): never {
  refusals.push({ tool: name, parent });
  console.error(`[phase-guard] refused ${name} inside ${parent}`);
  throw new Error(`"${name}" cannot run inside the "${parent}" phase. ${advice}`);
}

/**
 * Phases whose result is a function of their input, so a second call with the same input can return
 * the first call's result instead of doing the work again.
 *
 * The problem this solves, from `write-module-ref-turn9`: the model issues a batch of phase tools in
 * one turn, this guard refuses the ones that look nested, and the model then re-fires the WHOLE batch
 * — including the calls that had already succeeded. `research_data_type` ran 8 times for 4 types,
 * `design_module_plan` 3 times, and the run cost $3.30 against turn5's $2.17 for the same output. A
 * refusal leaves the model no way to keep the half of its batch that worked, so it repeats everything.
 *
 * Memoizing rather than forbidding is the point: a repeat becomes free instead of an error, so the
 * model's recovery strategy stops being expensive and nothing has to be explained to it.
 *
 * Deliberately NOT every phase. Each exclusion is a case where a repeat means something:
 *
 *  - `review_page` — a second round is supposed to re-read a page the writer has since fixed.
 *    Returning the first verdict is the exact bug an earlier `MAX_REVIEW_CALLS=1` shipped: a page went
 *    out whose recorded verdict still named a rule the writer had already fixed.
 *  - `write_*` — a redraft after review feedback arrives with the same plan and research, since
 *    neither changed. Memoizing would return the old page and silently discard the fix.
 *  - `integrate_*` and `write_companion_examples` — side effects on the site and on disk, which a
 *    caller may legitimately want re-applied after a page changes underneath them.
 *
 * Research and design are safe because their output is derived from their input by contract: research
 * already keeps a SQLite cache across runs for exactly that reason, and a plan is a function of the
 * research it was given.
 */
const MEMOIZABLE: ReadonlySet<string> = new Set([
  'research_data_type',
  'research_module',
  'research_tutorial_topic',
  'design_data_type_plan',
  'design_module_plan',
  'design_tutorial_plan',
]);

/**
 * In-flight and completed memoizable phase calls, keyed by tool name and input.
 *
 * The PROMISE is stored, not the resolved value, and that is what handles turn9's shape: the four
 * concurrent `research_data_type` calls arrive in one batch, so a duplicate within the same batch has
 * nothing to return yet — it awaits the first call instead of starting a second delegation.
 *
 * Module state, like the other per-run counters here: one OS process per run.
 */
const memo = new Map<string, Promise<unknown>>();

/** How many calls each phase answered from an earlier identical call. */
const hits = new Map<string, number>();

/**
 * Repeat calls collapsed per phase, for the end-of-run report.
 *
 * `phaseCalls` counts `tool_start`, so a collapsed repeat still shows up there — the model did call
 * the tool. Without this count the research/draft pairing in run-telemetry.ts would read 8 research
 * calls against 4 pages and report work that was never actually done.
 */
export function memoHits(): Readonly<Record<string, number>> {
  return Object.fromEntries(hits);
}

/** Reset the memo. Tests only — module state with no other seam. */
export function __resetPhaseMemoForTests(): void {
  memo.clear();
  hits.clear();
}

/**
 * A key that does not depend on the order the model happened to serialize its arguments in.
 *
 * The input arrives as generated JSON, so two identical calls can differ in key order. Sorting keys
 * recursively makes those equal; arrays keep their order, since a reordered array is a different
 * request (`constructionOrder` is exactly that).
 */
function stableKey(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableKey).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableKey(v)}`).join(',')}}`;
}

// `?? {}` only satisfies the erased type: a tool with no output schema may return void
// synchronously, which is legal, but `Promise<void>` is not — and wrapping makes every return a
// promise. `{}` carries the same "no output" meaning. Every flowrite tool wrapped here declares an
// output schema and returns `{ output }`, so this branch is unreachable today.
const normalize = <T>(result: T) => result ?? {};

/**
 * Wrap a phase tool so it refuses to run inside another phase.
 *
 * Rewrapping is safe: `defineTool` returns a frozen plain object of exactly
 * `{ name, description, input, output, harness, durable, run }` with no hidden internals, so
 * spreading it and replacing `run` yields an equivalent definition. Built directly rather than
 * passed back through `defineTool`, whose parameter type is narrower than the erased
 * `ToolDefinition` this receives — the original was already validated at its definition site.
 */
export function guardPhase(tool: ToolDefinition): ToolDefinition {
  return {
    ...tool,
    async run(ctx) {
      const parent = activePhase.getStore();
      if (parent) {
        refuse(
          tool.name,
          parent,
          `Delegate with the task tool, or return your result and let the writer ` +
            `call this phase next.`,
        );
      }
      if (!MEMOIZABLE.has(tool.name)) {
        return normalize(await activePhase.run(tool.name, async () => tool.run(ctx)));
      }

      const { data, log } = ctx as { data: unknown; log: Parameters<typeof note>[0] };
      const key = `${tool.name}:${stableKey(data)}`;
      const started = memo.get(key);
      if (started) {
        hits.set(tool.name, (hits.get(tool.name) ?? 0) + 1);
        note(log, `${tool.name} already ran with these arguments — returning that result unchanged.`);
        return normalize(await started);
      }

      const running = activePhase.run(tool.name, async () => tool.run(ctx));
      memo.set(key, running);
      try {
        return normalize(await running);
      } catch (error) {
        // Failures are not memoized: a refused or errored phase must stay retryable, and turn9's
        // whole problem was a model unable to make progress after a refusal.
        memo.delete(key);
        throw error;
      }
    },
  };
}

/**
 * Wrap a run-terminal tool so only the writer itself may call it.
 *
 * `report_run_result` records the run's outcome, so exactly one caller is correct: the root
 * writer, once, after everything else. A phase calling it is always wrong, and it happened —
 * `review_data_type_ref` filed the report 40 minutes before its own review finished, and the
 * module-ref run had three reports because three phases each filed one. Same inheritance hazard as
 * re-entry: every phase's harness conversation receives the writer's system prompt verbatim,
 * including SHARED_DIRECTIVE's "when the work is done, call report_run_result", and acts on it.
 *
 * Separate from `guardPhase` because the two differ in both directions. This one opens no phase
 * frame — a report is not a phase and must not make a later sibling call look nested — and its
 * advice tells the caller to return its result rather than to delegate, since delegating a report
 * would just move the same mistake.
 */
export function guardRootOnly(tool: ToolDefinition): ToolDefinition {
  return {
    ...tool,
    async run(ctx) {
      const parent = activePhase.getStore();
      if (parent) {
        refuse(
          tool.name,
          parent,
          `It reports the outcome of the whole run, so only the writer may call it, once, ` +
            `at the very end. Return your result and let the writer report.`,
        );
      }
      return normalize(await tool.run(ctx));
    },
  };
}
