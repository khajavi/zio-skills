// Kept as its own module so every phase tool's import stays put; the value now
// comes from the run context (set from the agent's initialData) rather than from
// a SKIP_PHASES env var. See run-context.ts for why the env channel is gone.
export { isPhaseSkipped, type SkipPhase } from './run-context.ts';
