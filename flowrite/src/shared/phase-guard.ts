import { AsyncLocalStorage } from 'node:async_hooks';
import type { ToolDefinition } from '@flue/runtime';

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
        // Logged because refusals are the only direct evidence the guard is working: counting
        // `Maximum delegation depth` errors does NOT measure re-entry — nesting only errors if it
        // happens to reach depth 4, and repro runs nested with zero errors. stderr, never stdout:
        // stdout carries the reply and `--json` must stay parseable.
        console.error(`[phase-guard] refused ${tool.name} inside ${parent}`);
        // Thrown, not returned: the runtime surfaces a thrown error as a tool error, which the
        // calling model reads as an instruction. Measured behaviour is that it then reaches the
        // goal another way rather than looping.
        throw new Error(
          `"${tool.name}" cannot run inside the "${parent}" phase. ` +
            `Delegate with the task tool, or return your result and let the writer ` +
            `call this phase next.`,
        );
      }
      // `?? {}` only satisfies the erased type: a tool with no output schema may return void
      // synchronously, which is legal, but `Promise<void>` is not — and wrapping makes every
      // return a promise. `{}` carries the same "no output" meaning. Every flowrite phase tool
      // declares an output schema and returns `{ output }`, so this branch is unreachable today.
      const result = await activePhase.run(tool.name, async () => tool.run(ctx));
      return result ?? {};
    },
  };
}
