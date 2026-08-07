import {
  type AgentProps,
  type SkillReference,
  type ToolDefinition,
  useInitialData,
  useInstruction,
  useSandbox,
  useSkill,
  useSubagent,
  useTool,
} from '@flue/runtime';
import { local } from '@flue/runtime/node';
import * as v from 'valibot';

// reusable baseline (supplies model tier + the writing-style skill)
import { useDocsAuthorBase } from './docs-author-base.ts';
import { getRepoPath, setRunContext } from './run-context.ts';
import { useUsageReport } from './usage-report.ts';

// role delegates — the generic, document-kind-neutral roles shared by every docs
// writer; the kind-specific focus/schema/checklist is supplied by each phase tool
// at its delegation call site. The design/write/review phases delegate to narrow
// roles declaring no phase tools of their own, avoiding the self-recursion hazard
// of prompting the calling agent's own conversation.
import { researcher } from '../subagents/researcher.ts';
import { designer } from '../subagents/designer.ts';
import { drafter } from '../subagents/drafter.ts';
import { reviewer } from '../subagents/reviewer.ts';
import { examplesBuilder } from '../subagents/examples-builder.ts';
import { docsIntegrator } from '../subagents/docs-integrator.ts';
import { reviewResolver } from '../subagents/review-resolver.ts';
import { styleChecker } from '../subagents/style-checker.ts';
import { styleFixer } from '../subagents/style-fixer.ts';

import { createGhQueryTool } from '../tools/repo-tools.ts';

const ROLES = [
  researcher,
  designer,
  drafter,
  reviewer,
  examplesBuilder,
  docsIntegrator,
  reviewResolver,
  styleChecker,
  styleFixer,
];

const skipPhase = v.picklist(['research', 'design', 'write', 'write-examples', 'integrate', 'review']);

/**
 * The creation-data fields every docs writer takes. Each writer spreads these into
 * its own `initialData` static alongside its subject field (`typeName`, `topic`,
 * `moduleName`).
 *
 * Replaces the deleted workflows' input schemas. Validated once at the instance's
 * first contact, before anything durable is admitted, and read back with
 * `useInitialData()` — which is why the REPO_PATH/SKIP_PHASES/USER_PROMPT env
 * channel and its request-cloning middleware are gone (see run-context.ts).
 */
export const docsWriterFields = {
  projectPath: v.pipe(v.string(), v.description('Absolute path to the ZIO library checkout to document')),
  userPrompt: v.pipe(
    v.optional(v.string()),
    v.description('Optional free-form hint to steer the run, e.g. scope, emphasis, or known gotchas.'),
  ),
  skipPhases: v.pipe(
    v.optional(v.array(skipPhase), []),
    v.description(
      'Phases to skip (only code-gated phases; mdoc verify is agent-driven and always runs). ' +
        'Skipping a head-phase prefix resumes a run whose artifacts already exist, ' +
        'e.g. ["research", "design", "write"] runs only the examples/integrate/review tail.',
    ),
  ),
};

// Loose so a writer's own subject field passes through: the agent's initialData
// static already validated the whole shape at admission: this is a typed re-read
// of just the fields this hook needs.
const runFacts = v.looseObject(docsWriterFields);

/**
 * Operational directives identical for every docs writer, appended after the
 * caller's own run directive. Lived in each deleted workflow's `buildPrompt`;
 * they are run-invariant, so they belong in the agent rather than in the
 * per-run message, which is now just a short kick-off line.
 */
const SHARED_DIRECTIVE =
  `Your shell already starts in the repo root of the library checkout — use relative paths ` +
  `for every command; do not cd into the repo. ` +
  `Report the final page path, a one-line summary, and a run retrospective: the real obstacles ` +
  `you hit this run and how you resolved them (empty if it went smoothly — never invent friction).`;

/**
 * Shared composition for ZIO documentation-authoring agents (tutorial-writer,
 * data-type-ref-writer, …). Every such agent runs the same flow with the same role
 * delegates, model tier, sandbox, and gh tool — they differ only in their
 * orchestration instructions, the kind-specific skills, and the phase tools that
 * drive each step. Supply those three; everything else is fixed here. Returns the
 * instructions for the caller to return as its own.
 *
 * A custom hook rather than a factory, for two reasons: Flue 2 replaced profiles
 * with hook composition, and an agent's durable identity is its own exported
 * function name — so each writer must declare that function itself rather than
 * receive one from a factory.
 */
export function useDocsWriter(
  props: AgentProps,
  opts: {
    /** Human label for the id in the missing-creation-data error, e.g. 'data type'. */
    idLabel: string;
    /** Log prefix for the end-of-run usage summary, e.g. 'write-data-type-ref'. */
    label: string;
    instructions: string;
    skills: SkillReference[];
    tools: ToolDefinition[];
    /** What to do this run, built from the writer's own creation data. */
    runDirective: string;
  },
): string {
  const parsed = v.safeParse(runFacts, useInitialData());
  if (!parsed.success) {
    throw new Error(
      `Creation data is required before running (${opts.idLabel} id: ${props.id}) — ` +
        `pass it with \`flue run --data '{"projectPath":"…"}'\`. ` +
        `Validation said: ${parsed.issues.map((i) => i.message).join('; ')}`,
    );
  }

  // Publish the run's facts for the phase tools and role renders, neither of which
  // can reach useInitialData() (it returns undefined in a subagent render).
  // Idempotent, so repeating it on every render is harmless.
  setRunContext({
    projectPath: parsed.output.projectPath,
    userPrompt: parsed.output.userPrompt,
    skipPhases: parsed.output.skipPhases,
  });

  // Owns useModel, so nothing here may call it again — it throws on a second call
  // in one render.
  useDocsAuthorBase();
  useSandbox(local(), { cwd: parsed.output.projectPath });

  for (const skill of opts.skills) useSkill(skill);
  for (const tool of opts.tools) useTool(tool);
  useTool(createGhQueryTool(getRepoPath));
  for (const role of ROLES) useSubagent(role);

  useUsageReport(opts.label);
  useInstruction(`${opts.runDirective} ${SHARED_DIRECTIVE}`);
  return opts.instructions;
}
