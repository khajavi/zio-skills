/**
 * Optional free-form user hint for the current run; appended to subagent task
 * prompts so the hint reaches the agents that do the actual work (the top
 * agent's prompt alone cannot forward it — action prompts are built in code).
 * Set by the workflow run() from input.userPrompt, same pattern as
 * REPO_PATH/SKIP_PHASES (see skip-phases.ts). Read fresh each call so a
 * long-lived dev server picks up the current run's value.
 */
export function authorHint(): string {
  const hint = process.env.USER_PROMPT?.trim();
  return hint ? `\nAuthor hint from the user — treat as a constraint for this task: ${hint}` : '';
}
