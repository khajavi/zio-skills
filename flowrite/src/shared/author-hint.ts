// Kept as its own module so every phase tool's import stays put; the hint now
// comes from the run context (set from the agent's initialData) rather than from
// a USER_PROMPT env var. See run-context.ts for why the env channel is gone.
export { authorHint } from './run-context.ts';
