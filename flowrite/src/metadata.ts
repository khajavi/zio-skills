'use agent';
import { useInitialData, useModel, useSandbox, useSkill } from '@flue/runtime';
import { local } from '@flue/runtime/node';
import * as v from 'valibot';

import instructions from './instructions/metadata.md';
// The skill's reference file, imported as a string rather than mounted, for the reason
// `runtime/kind-docs.ts` records and measures: mounting costs "three tool round-trips to activate a
// skill and read its resource, each re-sending its whole accumulated context". Progressive disclosure
// earns that for a writer carrying seven skills it uses some of; it is pure loss for an agent whose
// only job is these two fields, which needs the rules on turn 1 of every run. Mounting would also add
// a way to fail — the model declining to activate, then writing frontmatter without reading the form.
import rules from './skills/page-metadata/references/rules.md';
// Mounted, unlike the rules, and for the mirror-image reason: a description is prose, so rule 3 (no
// padding or filler) can bite, but the other 27 rules are about a page body this agent never touches.
// Paying for all 28 on every turn would be the waste kind-docs measured in the other direction.
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
export const RUN_LABEL = 'backfill-metadata';

/**
 * Only the machine setting a sentence cannot express. The page to edit comes from the message, on the
 * same reasoning as the writer's subject (see agent.ts) and the redundancy editor's page: a path is
 * something the requester says.
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
 * Fills a documentation page's missing `description` and `keywords` frontmatter.
 *
 * flowrite's second standalone entry point, after `src/redundancy.ts`. Both are maintenance passes
 * over pages that already exist rather than phases every write run pays for. This one closes
 * WRITER-ASSISTANT-MIGRATION.md §5: the drafter writes all four frontmatter fields on pages flowrite
 * authors, and nothing retro-fitted a page it did not write.
 *
 *   flue run src/metadata.ts -m "Backfill frontmatter metadata in docs/reference/lens.md" \
 *     --data '{"projectPath":"/path/to/checkout"}'
 *
 * One page per run, by design. `scripts/backfill-metadata.sh` is the loop, which keeps the "have I
 * done this page?" test reading the files themselves instead of a cursor a model maintains, and gives
 * every page a fresh context — see the plan's §3, and the spec.
 *
 * Deliberately small: no roles, no phase tools, no run context. It delegates nothing, so it needs no
 * roster; it gates nothing, so it needs no schema; and `useRunBasics` — the writer's setup — would
 * drag in the seven-role roster and the docKind machinery for an agent that has neither.
 */
export function MetadataWriter() {
  const data = v.parse(initialData, useInitialData());
  // Same resolution order as the writer's and the redundancy editor's: creation data, then REPO_PATH,
  // then the process cwd, so running from inside a checkout needs no path at all. local() binds with
  // no isolation — this agent EDITS what it is pointed at, so point it at a directory you are willing
  // to have changed, on a clean working tree.
  const projectPath = data.projectPath ?? process.env.REPO_PATH ?? process.cwd();

  // Not useDocsAuthorBase(): that owns useModel and pins the writer tier (Sonnet/high), which is the
  // wrong shape and the wrong price for filling two fields. It also mounts writing-style, which is
  // done below instead.
  useModel(TIERS.metadataWriter.model, { thinkingLevel: TIERS.metadataWriter.thinkingLevel });
  useSkill(writingStyle);
  useSandbox(local({ cwd: projectPath }));
  useUsageReport(RUN_LABEL);

  return [instructions, '', '# The fields you write', '', rules].join('\n');
}

/**
 * Pinned rather than inherited from the function name, for the reason the writer's static records:
 * storage is keyed by the identifier, so a rename orphans every conversation under the old key.
 */
MetadataWriter.agentName = 'metadata-writer';
MetadataWriter.initialData = initialData;

// No `durability` static. The writer needs six hours because a module reference drives sbt through
// eight phases; this reads one page, edits its frontmatter, and stops well inside the runtime's
// default hour.
