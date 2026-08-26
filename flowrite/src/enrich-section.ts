'use agent';
import { useInitialData, useModel, useSandbox, useSkill } from '@flue/runtime';
import { local } from '@flue/runtime/node';
import * as v from 'valibot';

import instructions from './instructions/enrich-section.md';
// Imported as a string rather than mounted, for the reason `runtime/kind-docs.ts` records and
// measures: mounting costs "three tool round-trips to activate a skill and read its resource, each
// re-sending its whole accumulated context". That is pure loss for an agent whose only job is this
// one, which needs the pattern on turn 1 of every run — and mounting would add a way to fail, the
// model deciding the task does not match and rewriting the section without the five-part shape.
import guide from './skills/enrich-section/references/pattern.md';
// Mounted, unlike the guide: this agent writes prose and a runnable example, so both rule sets apply
// to everything it produces.
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
export const RUN_LABEL = 'enrich-section';

/**
 * Only the machine setting a sentence cannot express. The page and the thin section come from the
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
 * Expands one thin section of an existing reference page — signature and toy example, no motivation —
 * into one that explains why a reader would choose this API, using the five-part expansion pattern.
 *
 * flowrite's eighth standalone entry point, after `src/redundancy.ts`, `src/metadata.ts`,
 * `src/crossref.ts`, `src/organize.ts`, `src/add-section.ts`, `src/check-compliance.ts` and
 * `src/pr-subsection.ts` — all maintenance passes over pages that already exist rather than phases
 * every write run pays for. Ported from the `docs-enrich-section` plugin skill; sibling to
 * `add-section.ts` in shape (both edit one section of an existing page) but opposite in failure
 * mode — that one inserts into empty space, this one replaces content that already shipped, which is
 * why its tier reasoning differs (see `runtime/models.ts`).
 *
 *   flue run src/enrich-section.ts -m "Enrich the Construction section of docs/reference/chunk.md" \
 *     --data '{"projectPath":"/path/to/checkout"}'
 *
 * Deliberately small: no roles, no phase tools, no run context. It delegates nothing — the source
 * research in its instructions (read the implementation, find the contrast, find real usage) is done
 * in this one conversation, the same way every sibling standalone agent works.
 */
export function SectionEnricher() {
  const data = v.parse(initialData, useInitialData());
  // Same resolution order as the other standalone agents: creation data, then REPO_PATH, then the
  // process cwd. local() binds with no isolation — this agent edits the page it is pointed at, so
  // point it at a directory you are willing to have changed, on a clean tree.
  const projectPath = data.projectPath ?? process.env.REPO_PATH ?? process.cwd();

  useModel(TIERS.sectionEnricher.model, { thinkingLevel: TIERS.sectionEnricher.thinkingLevel });
  useSkill(writingStyle);
  useSkill(mdocConventions);
  useSandbox(local({ cwd: projectPath }));
  useUsageReport(RUN_LABEL);

  return [instructions, '', '# The five-part expansion pattern', '', guide].join('\n');
}

/**
 * Pinned rather than inherited from the function name, for the reason the writer's static records:
 * storage is keyed by the identifier, so a rename orphans every conversation under the old key.
 */
SectionEnricher.agentName = 'section-enricher';
SectionEnricher.initialData = initialData;

// No `durability` static. It reads one section and its source, rewrites that section, and verifies
// with a single-file mdoc compile — well inside the runtime's default hour.
