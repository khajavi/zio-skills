'use agent';
import { useInitialData, useModel, useSandbox } from '@flue/runtime';
import { local } from '@flue/runtime/node';
import * as v from 'valibot';

import instructions from './instructions/check-compliance.md';
// Both rule sets imported as strings rather than mounted, for the reason `runtime/kind-docs.ts`
// records and measures: mounting costs "three tool round-trips to activate a skill and read its
// resource, each re-sending its whole accumulated context". Pure loss here — checking these rules IS
// this agent's only job, on turn 1 of every run, so there is no "sometimes" to defer.
import mdocConventions from './skills/mdoc-conventions/SKILL.md';
import writingStyleRules from './skills/writing-style/references/rules.md';
import { TIERS } from './runtime/models.ts';
import { useUsageReport } from './runtime/usage-report.ts';

/**
 * The log prefix for this agent's end-of-run usage summary.
 *
 * Exported because a fixture's `scripts/archive-docs.sh` takes it as an argument and greps
 * `<label> token consumption:` / `<label> component usage:` with it, so a typo here breaks archiving
 * silently. agent.test.ts asserts the string for that reason.
 */
export const RUN_LABEL = 'check-compliance';

/**
 * Only the machine setting a sentence cannot express. The page and (optionally) which rule set come
 * from the message, on the same reasoning as the other standalone agents' targets: a path is something
 * the requester says.
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
 * Audits one existing page against the writing-style rules, the mdoc-conventions rules, or both,
 * fixing every violation with one commit each and proving the page still compiles.
 *
 * flowrite's sixth standalone entry point, after `src/redundancy.ts`, `src/metadata.ts`,
 * `src/crossref.ts`, `src/organize.ts` and `src/add-section.ts` — all maintenance passes over pages
 * that already exist rather than phases every write run pays for. Ported from the
 * `docs-check-compliance` plugin skill; it also absorbs what `docs-verify-compliance` was — a fixed
 * wrapper that ran check-compliance against both rule sets in turn — because with only two rule sets
 * to enforce, "check whichever the request names, default both" is the whole of what that wrapper did.
 *
 *   flue run src/check-compliance.ts -m "Check docs/reference/chunk.md against writing-style" \
 *     --data '{"projectPath":"/path/to/checkout"}'
 *
 * Deliberately small: no roles, no phase tools, no run context, and no tools. It delegates nothing —
 * both rule sets are provided in full below, so there is nothing a subagent would do that reading the
 * text and the page directly does not already cover.
 */
export function ComplianceChecker() {
  const data = v.parse(initialData, useInitialData());
  // Same resolution order as the other standalone agents: creation data, then REPO_PATH, then the
  // process cwd. local() binds with no isolation — this agent edits the page it is pointed at, so
  // point it at a directory you are willing to have changed, on a clean tree.
  const projectPath = data.projectPath ?? process.env.REPO_PATH ?? process.cwd();

  useModel(TIERS.complianceChecker.model, { thinkingLevel: TIERS.complianceChecker.thinkingLevel });
  useSandbox(local({ cwd: projectPath }));
  useUsageReport(RUN_LABEL);

  return [
    instructions,
    '',
    '# Writing-style rules (numbered, 1-28)',
    '',
    writingStyleRules,
    '',
    '# mdoc-conventions rules',
    '',
    mdocConventions,
  ].join('\n');
}

/**
 * Pinned rather than inherited from the function name, for the reason the writer's static records:
 * storage is keyed by the identifier, so a rename orphans every conversation under the old key.
 */
ComplianceChecker.agentName = 'compliance-checker';
ComplianceChecker.initialData = initialData;

// No `durability` static. It reads one page, checks it against two fixed rule sets, and verifies with
// a single-file mdoc compile — well inside the runtime's default hour.
