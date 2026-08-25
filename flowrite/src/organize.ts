'use agent';
import { useInitialData, useModel, useSandbox, useSkill } from '@flue/runtime';
import { local } from '@flue/runtime/node';
import * as v from 'valibot';

import instructions from './instructions/organize.md';
// Imported as a string rather than mounted, for the reason `runtime/kind-docs.ts` records and
// measures: mounting costs "three tool round-trips to activate a skill and read its resource, each
// re-sending its whole accumulated context". Pure loss for an agent whose only job is this one, which
// needs the bounds and the sidebar rules on turn 1 — and mounting adds a way to fail, the model
// declining to activate and then editing sidebars.js without the id rules.
import guide from './skills/organize-reference-docs/references/guide.md';
// Mounted, unlike the guide: this agent authors the category index pages, so it writes prose and the
// 28 rules apply — but it writes very little of it, so paying for them on every turn would be the
// waste kind-docs measured in the other direction.
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
export const RUN_LABEL = 'organize-reference-docs';

/**
 * Only the machine setting a sentence cannot express. The section to organize comes from the message,
 * on the same reasoning as the other standalone agents' page paths: a path is something the requester
 * says.
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
 * Groups an existing reference section into sidebar categories, each with an index page.
 *
 * flowrite's fourth standalone entry point, after `src/redundancy.ts`, `src/metadata.ts` and
 * `src/crossref.ts` — all maintenance passes over pages that already exist rather than phases every
 * write run pays for. This one closes WRITER-ASSISTANT-MIGRATION.md §9 (`organize-types`, renamed here
 * because it organizes reference pages rather than types as such).
 *
 *   flue run src/organize.ts -m "Organize docs/reference into categories" \
 *     --data '{"projectPath":"/path/to/checkout"}'
 *
 * It moves NO files, and that bound is the design rather than a simplification. A page's links are
 * relative to where it sits, so relocating one breaks every reference to it and every `../` inside it,
 * and `onBrokenLinks: 'throw'` then fails the build with a list that does not name the cause. So a
 * category here is a sidebar grouping plus an index page. The predecessor emitted sidebar ids of the
 * form `reference/<category>/<type>` while moving nothing, which pointed entries at files it never
 * created — and its build-repair phase was licensed to "either create the missing file or remove the
 * entry", which is BACKLOG finding 1's failure exactly.
 *
 * Deliberately small: no roles, no phase tools, no run context, and no tools. The one thing it needs
 * that a shell cannot give it is judgement about what a group of pages is FOR, which is the whole
 * reason this is an agent and not a script.
 */
export function DocsOrganizer() {
  const data = v.parse(initialData, useInitialData());
  // Same resolution order as the other standalone agents: creation data, then REPO_PATH, then the
  // process cwd. local() binds with no isolation — this agent writes index pages and edits
  // sidebars.js, so point it at a directory you are willing to have changed, on a clean tree.
  const projectPath = data.projectPath ?? process.env.REPO_PATH ?? process.cwd();

  // Not useDocsAuthorBase(): that owns useModel and pins the writer tier, and it mounts writing-style,
  // which is done below instead.
  useModel(TIERS.docsOrganizer.model, { thinkingLevel: TIERS.docsOrganizer.thinkingLevel });
  useSkill(writingStyle);
  useSandbox(local({ cwd: projectPath }));
  useUsageReport(RUN_LABEL);

  return [instructions, '', '# The organizing guide', '', guide].join('\n');
}

/**
 * Pinned rather than inherited from the function name, for the reason the writer's static records:
 * storage is keyed by the identifier, so a rename orphans every conversation under the old key.
 */
DocsOrganizer.agentName = 'docs-organizer';
DocsOrganizer.initialData = initialData;

// No `durability` static. It reads a section, writes a few short index pages and one sidebar edit,
// well inside the runtime's default hour.
