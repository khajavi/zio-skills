'use agent';
import { useInitialData, useModel, useSandbox, useSkill } from '@flue/runtime';
import { local } from '@flue/runtime/node';
import * as v from 'valibot';

import instructions from './instructions/pr-subsection.md';
import mdocConventions from './skills/mdoc-conventions/SKILL.md';
import writingStyle from './skills/writing-style/SKILL.md';
import { TIERS } from './runtime/models.ts';
import { useUsageReport } from './runtime/usage-report.ts';

/**
 * The log prefix for this agent's end-of-run usage summary.
 *
 * Exported because a fixture's `scripts/archive-docs.sh` takes it as an argument and greps
 * `<label> token consumption:` / `<label> component usage:` with it, so a typo here breaks archiving
 * silently. agent.test.ts asserts the string for that reason.
 */
export const RUN_LABEL = 'pr-subsection';

/**
 * Only the machine setting a sentence cannot express. The PR number and, when the request already
 * knows it, the target page come from the message — a path (and a PR number) is something the
 * requester says, the same reasoning as every other standalone agent's target.
 *
 * Wrapped in `v.optional(..., {})` because absence would otherwise reject the creating send, and
 * `flue run … -m "…"` from inside a checkout must work with no --data at all.
 */
const initialData = v.optional(
  v.object({
    projectPath: v.pipe(
      v.optional(v.string()),
      v.description('The checkout holding the docs tree. Defaults to REPO_PATH, then cwd.'),
    ),
  }),
  {},
);

/**
 * Turns a GitHub pull request into one subsection appended to a page that already documents the area
 * it touches — no new page, no sidebar edit.
 *
 * flowrite's seventh standalone entry point, after `src/redundancy.ts`, `src/metadata.ts`,
 * `src/crossref.ts`, `src/organize.ts`, `src/add-section.ts` and `src/check-compliance.ts`. Ported
 * from the `docs-document-pr` plugin skill, but only its "append a subsection" path (its own Phase
 * 3c): the "write a new page from a PR" path (3a/3b) was already covered, and covered better, by
 * `src/agent.ts`'s own gate instructions — "A PR, issue or commit is a SOURCE, not a subject: read it
 * … and take the kind and subject from what it changed" — which runs the full research → design →
 * write → fact-check → review pipeline rather than the plugin skill's bare "invoke docs-data-type-ref"
 * hand-off. Porting that path again here would have been a second, worse copy of a thing that already
 * exists.
 *
 * The PR-and-issue fetch below mirrors `subagents/researcher.md` step 6 exactly (same `gh` flags, no
 * `--repo` — `gh` infers it from the checkout) rather than inventing a second convention for the same
 * two commands.
 *
 *   flue run src/pr-subsection.ts -m "Document PR #1234 as a subsection" \
 *     --data '{"projectPath":"/path/to/checkout"}'
 *
 * Deliberately small: no roles, no phase tools, no run context, and no subagents. It delegates
 * nothing — the PR fetch is two `gh` calls this one conversation makes directly, the same shape as
 * every sibling standalone agent.
 */
export function PrSubsectionWriter() {
  const data = v.parse(initialData, useInitialData());
  // Same resolution order as the other standalone agents: creation data, then REPO_PATH, then the
  // process cwd. local() binds with no isolation — this agent edits the page it is pointed at, so
  // point it at a directory you are willing to have changed, on a clean tree.
  const projectPath = data.projectPath ?? process.env.REPO_PATH ?? process.cwd();

  useModel(TIERS.prSubsectionWriter.model, { thinkingLevel: TIERS.prSubsectionWriter.thinkingLevel });
  useSkill(writingStyle);
  useSkill(mdocConventions);
  useSandbox(local({ cwd: projectPath }));
  useUsageReport(RUN_LABEL);

  return instructions;
}

/**
 * Pinned rather than inherited from the function name, for the reason the writer's static records:
 * storage is keyed by the identifier, so a rename orphans every conversation under the old key.
 */
PrSubsectionWriter.agentName = 'pr-subsection-writer';
PrSubsectionWriter.initialData = initialData;

// No `durability` static. It fetches one PR and its linked issues, writes one subsection, and
// verifies with a single-file mdoc compile — well inside the runtime's default hour.
