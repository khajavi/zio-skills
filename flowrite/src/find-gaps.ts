'use agent';
import { useInitialData, useModel, useSandbox } from '@flue/runtime';
import { local } from '@flue/runtime/node';
import { fileURLToPath } from 'node:url';
import * as v from 'valibot';

import instructions from './instructions/find-gaps.md';
import { TIERS } from './runtime/models.ts';
import { useUsageReport } from './runtime/usage-report.ts';

/**
 * The log prefix for this agent's end-of-run usage summary.
 *
 * Exported because a fixture's `scripts/archive-docs.sh` takes it as an argument and greps
 * `<label> token consumption:` / `<label> component usage:` with it, so a typo here breaks archiving
 * silently. agent.test.ts asserts the string for that reason.
 */
export const RUN_LABEL = 'find-gaps';

/**
 * Resolved once at module load, not per-run: the scanner lives in THIS package
 * (`flowrite/scripts/`), not in the checkout the sandbox is rooted at, so the model needs an
 * absolute path handed to it rather than a path relative to its own cwd.
 */
const SCANNER_PATH = fileURLToPath(new URL('../scripts/scan-undocumented.sh', import.meta.url));

/**
 * Only the machine setting a sentence cannot express. The module to scope the scan to, if any, comes
 * from the message, on the same reasoning as the other standalone agents' targets.
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
 * Surveys a checkout for documentation gaps and writes one report, `docs/undocumented-report.md` —
 * no page is written, no page is edited, no sidebar changes.
 *
 * flowrite's ninth standalone entry point, after `src/redundancy.ts`, `src/metadata.ts`,
 * `src/crossref.ts`, `src/organize.ts`, `src/add-section.ts`, `src/check-compliance.ts`,
 * `src/pr-subsection.ts` and `src/enrich-section.ts` — all maintenance passes over a checkout that
 * already exists rather than phases every write run pays for. Ported from the
 * `docs-find-documentation-gaps` plugin skill, including its bundled `scan-undocumented.sh` almost
 * verbatim (`scripts/scan-undocumented.sh`) — 339 lines of working, tested mechanical scanning
 * (public-type extraction, kebab-case matching against existing pages, broken-link and stub-page
 * detection) that a model would either get wrong reproducing by hand or burn many turns re-deriving
 * every run. Kept as a bash script the model runs directly, the same shape as `backfill-metadata.sh`
 * and `archive-docs.sh`, rather than a Flue tool — its output is a Markdown report for the model to
 * read and enrich with judgment, not structured data a gate consumes the way `check_method_coverage`
 * is.
 *
 *   flue run src/find-gaps.ts -m "Find documentation gaps in the schema module" \
 *     --data '{"projectPath":"/path/to/checkout"}'
 *
 * Deliberately small: no roles, no phase tools, no run context, and no subagents. It delegates
 * nothing — the priority classification, depth check, and conceptual-gap survey in its instructions
 * are done by reading source and existing docs directly, the same way every sibling standalone agent
 * works.
 */
export function GapFinder() {
  const data = v.parse(initialData, useInitialData());
  // Same resolution order as the other standalone agents: creation data, then REPO_PATH, then the
  // process cwd. local() binds with no isolation — this agent writes one new file (the report) and
  // reads everything else, so point it at a checkout you are willing to have a file added to.
  const projectPath = data.projectPath ?? process.env.REPO_PATH ?? process.cwd();

  useModel(TIERS.gapFinder.model, { thinkingLevel: TIERS.gapFinder.thinkingLevel });
  useSandbox(local({ cwd: projectPath }));
  useUsageReport(RUN_LABEL);

  return instructions.replace('<scanner-path>', SCANNER_PATH);
}

/**
 * Pinned rather than inherited from the function name, for the reason the writer's static records:
 * storage is keyed by the identifier, so a rename orphans every conversation under the old key.
 */
GapFinder.agentName = 'gap-finder';
GapFinder.initialData = initialData;

// No `durability` static. It runs one scan, reads what the scan flags, and writes one report — well
// inside the runtime's default hour, even on a large checkout.
