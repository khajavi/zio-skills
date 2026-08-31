import {
  createBashTool,
  createEditTool,
  createGlobTool,
  createGrepTool,
  createReadTool,
  createWriteTool,
  type Sandbox,
  type SandboxFactory,
} from '@flue/runtime';

/**
 * Strip a redundant `cd <cwd> &&` / `cd <cwd>;` prefix from the start of a bash command.
 *
 * The shell already starts at `cwd` — every phase's instructions say so (composition.ts's
 * SHARED_DIRECTIVE, how-to-guide.md's guardrails) — and saying it a third time was never going to
 * help: a real run still cd'd into the repo root 18 times before running `sbt`/build commands, each
 * one repeating the absolute checkout path for no effect. This only removes a provable no-op: `cd
 * <cwd>` changes nothing, since the command was about to run there anyway.
 *
 * Deliberately narrow. It matches only at the very start of the command (a `cd` appearing later, or
 * inside a subshell, is left alone) and only the exact `cwd` path (quoted or not, an optional trailing
 * slash) followed by `&&`, `;`, or a newline — `cd <cwd>/subdir` is a real directory change and is
 * never touched. When the pattern doesn't match at the start, the command passes through unmodified.
 */
export function stripRedundantCdIntoCwd(command: string, cwd: string): string {
  const escaped = cwd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const quoted = `(?:"${escaped}"|'${escaped}'|${escaped})`;
  const pattern = new RegExp(`^\\s*cd\\s+${quoted}\\/?\\s*(?:&&|;|\\n)\\s*`);
  return command.replace(pattern, '');
}

/** The standard `bash` tool, wrapped to silently drop a redundant `cd <cwd>` prefix before running. */
function createGuardedBashTool(sandbox: Sandbox): ReturnType<typeof createBashTool> {
  const bash = createBashTool(sandbox);
  return {
    ...bash,
    execute(toolCallId, params, signal, onUpdate) {
      const command = (params as { command?: unknown }).command;
      const guarded =
        typeof command === 'string'
          ? { ...params, command: stripRedundantCdIntoCwd(command, sandbox.cwd) }
          : params;
      return bash.execute(toolCallId, guarded, signal, onUpdate);
    },
  };
}

/**
 * Wraps a `SandboxFactory` so its `bash` tool silently drops a redundant leading `cd <repo-root>`
 * instead of running it as real (harmless but wasted) shell work every time the model repeats it.
 *
 * Supplies the framework's own standard tool set (per `SandboxToolFactory`'s docs: compose from the
 * standard factories rather than rebuilding) with only `bash` swapped for the guarded version above —
 * `read`/`write`/`edit`/`grep`/`glob` are untouched.
 */
export function withGuardedBash(factory: SandboxFactory): SandboxFactory {
  return {
    ...factory,
    tools: (sandbox) => [
      createReadTool(sandbox),
      createWriteTool(sandbox),
      createEditTool(sandbox),
      createGuardedBashTool(sandbox),
      createGrepTool(sandbox),
      createGlobTool(sandbox),
    ],
  };
}
