'use agent';
import { useInitialData, useModel, useSandbox, useTool } from '@flue/runtime';
import { local } from '@flue/runtime/node';
import * as v from 'valibot';

import instructions from './instructions/list-undocumented-prs.md';
import { classifyPrDocs } from './tools/classify-pr-docs.ts';
import { TIERS } from './runtime/models.ts';
import { useUsageReport } from './runtime/usage-report.ts';

/**
 * The log prefix for this agent's end-of-run usage summary.
 *
 * Exported because a fixture's `scripts/archive-docs.sh` takes it as an argument and greps
 * `<label> token consumption:` / `<label> component usage:` with it, so a typo here breaks archiving
 * silently. agent.test.ts asserts the string for that reason.
 */
export const RUN_LABEL = 'list-undocumented-prs';

/**
 * Only the machine setting a sentence cannot express. The batch size, a base ref, and whether to
 * reset all come from the message — the same reasoning as every other standalone agent's target.
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
 * Audits one batch of merged PRs for missing documentation: fetches each, classifies whether it
 * needs docs with the deterministic `classify_pr_docs` gate table, grades existing coverage against
 * a four-level rubric, and reports — persisting what it checked so the next run only sees new PRs.
 *
 * flowrite's tenth standalone entry point, after `src/redundancy.ts`, `src/metadata.ts`,
 * `src/crossref.ts`, `src/organize.ts`, `src/add-section.ts`, `src/check-compliance.ts`,
 * `src/pr-subsection.ts`, `src/enrich-section.ts` and `src/find-gaps.ts`. Ported from the
 * `docs-list-undocumented-prs` plugin skill, with its Phase 3 classification gate table moved out of
 * the model's hands entirely — `tools/classify-pr-docs.ts` computes it, the same division of labor
 * as `check_method_coverage`. Sixteen ordered boolean conditions applied by hand across a 20-PR batch
 * is exactly where a model quietly reorders or drops a gate; a misapplied gate is a SILENT wrong
 * classification, not a loud failure, which is what earns it a tool rather than an instruction.
 *
 * Also dropped: the plugin's interactive "continue with the next batch?" loop. A `flue run` is a
 * single conversation with no one there to answer that question — this agent processes one batch and
 * stops, the same way `metadata.ts` writes one page per run ("the loop, which keeps the 'have I
 * already done this' state entirely in the filesystem"). Run it again for the next batch; the
 * persisted state makes that idempotent.
 *
 *   flue run src/list-undocumented-prs.ts -m "Audit the next batch of merged PRs for missing docs" \
 *     --data '{"projectPath":"/path/to/checkout"}'
 *
 * No roles, no phase tools, no subagents — the PR and file fetches are `gh` calls this one
 * conversation makes directly, the same shape as every sibling standalone agent. `classify_pr_docs`
 * is its one plain tool, the first a standalone agent here has needed.
 */
export function PrAuditor() {
  const data = v.parse(initialData, useInitialData());
  // Same resolution order as the other standalone agents: creation data, then REPO_PATH, then the
  // process cwd. local() binds with no isolation — this agent writes only its audit state file and
  // reads everything else, so point it at the checkout you want audited.
  const projectPath = data.projectPath ?? process.env.REPO_PATH ?? process.cwd();

  useModel(TIERS.prAuditor.model, { thinkingLevel: TIERS.prAuditor.thinkingLevel });
  useTool(classifyPrDocs);
  useSandbox(local({ cwd: projectPath }));
  useUsageReport(RUN_LABEL);

  return instructions;
}

/**
 * Pinned rather than inherited from the function name, for the reason the writer's static records:
 * storage is keyed by the identifier, so a rename orphans every conversation under the old key.
 */
PrAuditor.agentName = 'pr-auditor';
PrAuditor.initialData = initialData;

// No `durability` static. One batch of up to 20 PRs, two `gh` calls and one tool call each, plus a
// handful of Greps for coverage grading — well inside the runtime's default hour.
