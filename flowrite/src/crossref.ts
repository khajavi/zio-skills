'use agent';
import { useInitialData, useModel, useSandbox, useSkill } from '@flue/runtime';
import { local } from '@flue/runtime/node';
import * as v from 'valibot';

import instructions from './instructions/crossref.md';
// Imported as a string rather than mounted, for the reason `runtime/kind-docs.ts` records and
// measures: mounting costs "three tool round-trips to activate a skill and read its resource, each
// re-sending its whole accumulated context". That is pure loss for an agent whose only job is this
// one, which needs the recipes and the ✅/❌ pairs on turn 1 of every run — and mounting would add a
// way to fail, the model declining to activate and then editing prose without the placement rules.
import guide from './skills/cross-linker/references/guide.md';
// Mounted, unlike the guide, and for the mirror-image reason: rule 7 governs link form, so it is
// consulted on every edit, but the other 27 rules are about prose this agent does not write. It wraps
// an existing phrase; it never composes a sentence.
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
export const RUN_LABEL = 'cross-link-page';

/**
 * Only the machine setting a sentence cannot express. The target page comes from the message, on the
 * same reasoning as the writer's subject (see agent.ts) and the other two standalone agents' pages: a
 * path is something the requester says.
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
 * Makes one orphan documentation page reachable, by adding inbound prose links from pages that
 * already discuss its subject.
 *
 * flowrite's third standalone entry point, after `src/redundancy.ts` and `src/metadata.ts` — all three
 * maintenance passes over pages that already exist rather than phases every write run pays for. This
 * one closes WRITER-ASSISTANT-MIGRATION.md §3 in part: the drafter links a sibling type's first
 * mention on the page it is writing (writing-style rule 7), and nothing retro-fitted links into a tree
 * flowrite did not write.
 *
 *   flue run src/crossref.ts -m "Make docs/reference/stm/tref.md reachable" \
 *     --data '{"projectPath":"/path/to/checkout"}'
 *
 * One TARGET per run, and the direction is the design. The original read a source page and linked out
 * to whatever it mentioned, which measurably enriches hubs: it proposed reference/fiber/index as a
 * target 12 times, a page that already had 8 inbound links, while 84 of 220 reference pages had none.
 * Inverting it also buys the completion test — "does anything link here yet" reads the files, the way
 * the metadata backfiller's frontmatter grep does, so a re-run is safe and an outbound pass could
 * never be.
 *
 * No driver script, unlike `scripts/backfill-metadata.sh`. That loop exists because metadata is a
 * per-page sweep needing env guards and a fresh process each time; here one run already covers a whole
 * target and its sources, and the guide's orphan recipe prints the list a human picks from — one
 * deliberate act per page rather than an unattended sweep over a tree that it edits in several places.
 *
 * Deliberately small: no roles, no phase tools, no run context, and no tools at all. The five the
 * original mounted (`search_pages`, `search_page_content`, `get_adjacent_pages`,
 * `extract_page_structure`, `validate_anchor`) are audit §12, already deleted on the finding that grep
 * and read beat a wrapper; the guide carries their recipes as shell instead.
 */
export function CrossLinker() {
  const data = v.parse(initialData, useInitialData());
  // Same resolution order as the other two standalone agents: creation data, then REPO_PATH, then the
  // process cwd, so running from inside a checkout needs no path at all. local() binds with no
  // isolation — this agent EDITS what it is pointed at, and unlike the other two it edits SEVERAL
  // files per run, so point it at a directory you are willing to have changed, on a clean tree.
  const projectPath = data.projectPath ?? process.env.REPO_PATH ?? process.cwd();

  // Not useDocsAuthorBase(): that owns useModel and pins the writer tier, and it mounts writing-style,
  // which is done below instead.
  useModel(TIERS.crossLinker.model, { thinkingLevel: TIERS.crossLinker.thinkingLevel });
  useSkill(writingStyle);
  useSandbox(local({ cwd: projectPath }));
  useUsageReport(RUN_LABEL);

  return [instructions, '', '# The linking guide', '', guide].join('\n');
}

/**
 * Pinned rather than inherited from the function name, for the reason the writer's static records:
 * storage is keyed by the identifier, so a rename orphans every conversation under the old key.
 */
CrossLinker.agentName = 'cross-linker';
CrossLinker.initialData = initialData;

// No `durability` static. This reads a handful of pages and edits a phrase in each, well inside the
// runtime's default hour.
