'use agent';
import { useInitialData, useModel, useSandbox, useSkill } from '@flue/runtime';
import { local } from '@flue/runtime/node';
import * as v from 'valibot';

import instructions from './instructions/redundancy.md';
// The skill's reference file, imported as a string rather than mounted. `runtime/kind-docs.ts` does
// this for six files and records the measurement: mounting costs "three tool round-trips to activate
// a skill and read its resource, each re-sending its whole accumulated context". That trade is worth
// it for a writer carrying seven skills it uses some of; it is pure loss for an agent whose only job
// is this one, which needs the guide on turn 1 of every run. Mounting would also add a way to fail —
// the model deciding the task does not match, and editing the page without reading the bounds.
//
// The directory is still a skill: nothing mounts it today, but the drafter might one day want to
// pre-empt redundancy while writing, and that is a `useSkill` line with no content moved.
import guide from './skills/reduce-redundancy/references/guide.md';
// Mounted, unlike the guide, and for the mirror-image reason: the 28 rules are consulted only when a
// cut happens to touch one, so paying for them on every turn would be the waste that kind-docs
// measured in the other direction.
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
export const RUN_LABEL = 'reduce-redundancy';

/**
 * Only the machine setting a sentence cannot express. The page to edit comes from the message, on the
 * same reasoning as the writer's subject (see agent.ts): a path is something the requester says.
 *
 * Wrapped in `v.optional(..., {})` because absence would otherwise reject the creating send, and
 * `flue run … -m "…"` from inside a checkout must work with no --data at all.
 */
const initialData = v.optional(
  v.object({
    projectPath: v.pipe(
      v.optional(v.string()),
      v.description('The library checkout holding the page. Defaults to REPO_PATH, then cwd.'),
    ),
  }),
  {},
);

/**
 * Removes repetition from one finished documentation page.
 *
 * flowrite's first standalone entry point. Everything else here runs as a phase of a write flow;
 * this is a maintenance pass over a page that already exists, so it is its own agent rather than a
 * step every run pays for. `writer-assistant` had both forms and this one is the one that was
 * missing (see WRITER-ASSISTANT-MIGRATION.md §4 and §8).
 *
 *   flue run src/redundancy.ts -m "reduce redundancy in docs/reference/ledger.md" \
 *     --data '{"projectPath":"/path/to/checkout"}'
 *
 * Deliberately small: no roles, no phase tools, no run context. It delegates nothing, so it needs no
 * roster; it gates nothing, so it needs no schema; and `useRunBasics` — the writer's setup — would
 * drag in the seven-role roster and the docKind machinery for an agent that has neither.
 */
export function RedundancyEditor() {
  const data = v.parse(initialData, useInitialData());
  // Same resolution order as the writer's: creation data, then REPO_PATH, then the process cwd, so
  // running from inside a checkout needs no path at all. local() binds with no isolation — this
  // agent EDITS what it is pointed at, so point it at a directory you are willing to have changed.
  const projectPath = data.projectPath ?? process.env.REPO_PATH ?? process.cwd();

  // Not useDocsAuthorBase(): that owns useModel and pins the writer tier (Sonnet/high), which is the
  // wrong shape and the wrong price for an editing pass. It also mounts writing-style, which is done
  // below instead.
  useModel(TIERS.redundancyEditor.model, { thinkingLevel: TIERS.redundancyEditor.thinkingLevel });
  useSkill(writingStyle);
  useSandbox(local({ cwd: projectPath }));
  useUsageReport(RUN_LABEL);

  return [instructions, '', '# The guide', '', guide].join('\n');
}

/**
 * Pinned rather than inherited from the function name, for the reason the writer's static records:
 * storage is keyed by the identifier, so a rename orphans every conversation under the old key.
 */
RedundancyEditor.agentName = 'redundancy-editor';
RedundancyEditor.initialData = initialData;

// No `durability` static. The writer needs six hours because a module reference drives sbt through
// eight phases; this reads one page, edits it, and stops well inside the runtime's default hour.
