'use agent';
import { useInitialData, useModel, useSandbox, useSkill } from '@flue/runtime';
import { local } from '@flue/runtime/node';
import * as v from 'valibot';

import instructions from './instructions/add-section.md';
// Imported as a string rather than mounted, for the reason `runtime/kind-docs.ts` records and
// measures: mounting costs "three tool round-trips to activate a skill and read its resource, each
// re-sending its whole accumulated context". That is pure loss for an agent whose only job is this
// one, which needs the patterns on turn 1 of every run — and mounting would add a way to fail, the
// model deciding the task does not match and writing the section without the templates.
import guide from './skills/add-missing-section/references/section-patterns.md';
// Mounted, unlike the guide: this agent writes prose and runnable examples, so both rule sets apply to
// everything it produces, not just the parts that happen to touch a pattern.
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
export const RUN_LABEL = 'add-missing-section';

/**
 * Only the machine setting a sentence cannot express. The page and the missing section come from the
 * message, on the same reasoning as the other standalone agents' targets: a path is something the
 * requester says.
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
 * Inserts one missing section into an existing reference page, at its canonical position, fully
 * written and mdoc-verified.
 *
 * flowrite's fifth standalone entry point, after `src/redundancy.ts`, `src/metadata.ts`,
 * `src/crossref.ts` and `src/organize.ts` — all maintenance passes over pages that already exist
 * rather than phases every write run pays for. This one was ported from the standalone
 * `docs-add-missing-section` plugin skill, split the same way every migrated capability here is:
 * the section-type templates stay a skill (`add-missing-section`), the workflow that uses them
 * becomes this agent's instructions.
 *
 *   flue run src/add-section.ts -m "Add a Comparison section to docs/reference/chunk.md" \
 *     --data '{"projectPath":"/path/to/checkout"}'
 *
 * Deliberately small: no roles, no phase tools, no run context, and no tools. It delegates nothing —
 * the research step in its instructions is grep-and-read, done in this one conversation, not a
 * subagent call, the same way `organize.ts` reads pages itself rather than delegating to a researcher.
 * A missing section is bounded enough that a second conversation would cost more than it returns.
 */
export function SectionWriter() {
  const data = v.parse(initialData, useInitialData());
  // Same resolution order as the other standalone agents: creation data, then REPO_PATH, then the
  // process cwd. local() binds with no isolation — this agent edits the page it is pointed at, so
  // point it at a directory you are willing to have changed, on a clean tree.
  const projectPath = data.projectPath ?? process.env.REPO_PATH ?? process.cwd();

  useModel(TIERS.sectionWriter.model, { thinkingLevel: TIERS.sectionWriter.thinkingLevel });
  useSkill(writingStyle);
  useSkill(mdocConventions);
  useSandbox(local({ cwd: projectPath }));
  useUsageReport(RUN_LABEL);

  return [instructions, '', '# Section-type patterns', '', guide].join('\n');
}

/**
 * Pinned rather than inherited from the function name, for the reason the writer's static records:
 * storage is keyed by the identifier, so a rename orphans every conversation under the old key.
 */
SectionWriter.agentName = 'section-writer';
SectionWriter.initialData = initialData;

// No `durability` static. It reads one page and its source, writes one section, and verifies with a
// single-file mdoc compile — well inside the runtime's default hour.
