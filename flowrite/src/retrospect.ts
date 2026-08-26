'use agent';
import { useInitialData, useModel, useSandbox } from '@flue/runtime';
import { local } from '@flue/runtime/node';
import * as v from 'valibot';

import instructions from './instructions/retrospect.md';
import { TIERS } from './runtime/models.ts';
import { useUsageReport } from './runtime/usage-report.ts';

/**
 * The log prefix for this agent's end-of-run usage summary.
 *
 * Exported because a fixture's `scripts/archive-docs.sh` takes it as an argument and greps
 * `<label> token consumption:` / `<label> component usage:` with it, so a typo here breaks archiving
 * silently. agent.test.ts asserts the string for that reason.
 */
export const RUN_LABEL = 'retrospect';

/**
 * Only the machine setting a sentence cannot express. Which run to retrospect, its log path, and
 * which instructions/skill file governed it all come from the message, on the same reasoning as
 * every other standalone agent's target.
 *
 * Wrapped in `v.optional(..., {})` because absence would otherwise reject the creating send, and
 * `flue run … -m "…"` from inside a checkout must work with no --data at all.
 */
const initialData = v.optional(
  v.object({
    projectPath: v.pipe(
      v.optional(v.string()),
      v.description(
        'The checkout holding the instructions/skill files to retrospect. Usually flowrite itself — ' +
          'defaults to REPO_PATH, then cwd, so running from inside the flowrite checkout needs nothing here.',
      ),
    ),
  }),
  {},
);

/**
 * Closes the feedback loop on one flowrite run: reads its log, compares actual behavior against the
 * instructions and skills that governed it, classifies every real deviation, and applies the
 * smallest edit that would have prevented it.
 *
 * flowrite's eleventh standalone entry point, after `src/redundancy.ts`, `src/metadata.ts`,
 * `src/crossref.ts`, `src/organize.ts`, `src/add-section.ts`, `src/check-compliance.ts`,
 * `src/pr-subsection.ts`, `src/enrich-section.ts`, `src/find-gaps.ts` and
 * `src/list-undocumented-prs.ts`. Ported from the `docs-skill-retrospection` plugin skill, with its
 * two Claude-Code-specific mechanics replaced by flowrite's own equivalents rather than carried over
 * unchanged:
 *
 * - The plugin reads the same-session conversation, or falls back to a `~/.claude/projects/*.jsonl`
 *   transcript for a past session. Flue has neither concept — a run's record is its log — so this
 *   agent reads a `flue.log` (or an archived copy) instead, per `runtime/log.ts`'s actual tagging
 *   convention (`grep 'flowrite:'`) and `runtime/verbose-observer.ts`'s `[verbose]` timeline. Getting
 *   this right mattered enough to check directly: `verbose-observer.ts` itself records that an
 *   EARLIER version of `investigate-flowrite-log`'s advice to grep for `info ` lines "never matched
 *   anything", because `log.info` needed an observer to print at all — exactly the kind of "wrong
 *   instruction" deviation this agent exists to catch and fix, now fixed at the source instead.
 * - The plugin edits a `SKILL.md` under `.claude/skills/`. This agent edits an instructions file
 *   under `src/instructions/` and, where the deviation lives there instead, one of the `SKILL.md`
 *   files it mounts under `src/skills/` — flowrite's split of the same concept.
 *
 *   flue run src/retrospect.ts \
 *     -m "Retrospect the write-data-type-ref run logged at flue.log for the Chunk page" \
 *     --data '{"projectPath":"/path/to/flowrite"}'
 *
 * No roles, no phase tools, no subagents — reading the log and the instructions, and editing the
 * instructions, all happen in this one conversation.
 */
export function Retrospector() {
  const data = v.parse(initialData, useInitialData());
  // Same resolution order as the other standalone agents: creation data, then REPO_PATH, then the
  // process cwd — which, run from inside a flowrite checkout, already points this agent at its own
  // instructions and skills with no path to supply. local() binds with no isolation: this agent edits
  // files that govern every future run, so point it at a checkout you are willing to have changed.
  const projectPath = data.projectPath ?? process.env.REPO_PATH ?? process.cwd();

  useModel(TIERS.retrospector.model, { thinkingLevel: TIERS.retrospector.thinkingLevel });
  useSandbox(local({ cwd: projectPath }));
  useUsageReport(RUN_LABEL);

  return instructions;
}

/**
 * Pinned rather than inherited from the function name, for the reason the writer's static records:
 * storage is keyed by the identifier, so a rename orphans every conversation under the old key.
 */
Retrospector.agentName = 'retrospector';
Retrospector.initialData = initialData;

// No `durability` static. It reads one log and one or two instructions/skill files, and writes a
// small targeted edit — well inside the runtime's default hour.
