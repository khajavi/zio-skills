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
import { guardPhase, guardRootOnly } from './phase-guard.ts';
import { getRepoPath, setRunContext } from './run-context.ts';
import { createReportRunResultTool } from './run-result.ts';
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
 * `useInitialData()` — which is what retired the SKIP_PHASES/USER_PROMPT env channel
 * and its request-cloning middleware (see run-context.ts). REPO_PATH survives, not
 * as that channel but as an ordinary override for `projectPath`.
 */
export const docsWriterFields = {
  projectPath: v.pipe(
    v.optional(v.string()),
    v.description(
      'Absolute path to the ZIO library checkout to document. Omit to fall back to ' +
        'REPO_PATH, then to the process working directory.',
    ),
  ),
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
 * Submission durability for every docs writer, assigned to each writer's
 * `durability` static.
 *
 * Flue 2 applies a one-hour submission deadline by default, which beta had no
 * equivalent of — flowrite never configured durability because nothing timed a run
 * out. A full pipeline is research → design → write → per-type subpages → examples
 * → mdoc → integrate → review, driving sbt throughout; a module reference with four
 * core types blew straight past the hour and settled `failed` mid-review. Six hours
 * is the runtime's own suggested figure for a long-running agent.
 *
 * `maxAttempts` is 2 rather than the default 10: an attempt here is a full,
 * expensive pipeline re-run, so one automatic retry after a crash is worth having
 * and nine are not. A timeout is terminal and is not retried either way.
 */
export const docsWriterDurability = { timeoutMs: 6 * 60 * 60 * 1_000, maxAttempts: 2 };

/**
 * Operational directives identical for every docs writer, appended after the
 * caller's own run directive. Lived in each deleted workflow's `buildPrompt`;
 * they are run-invariant, so they belong in the agent rather than in the
 * per-run message, which is now just a short kick-off line.
 */
const SHARED_DIRECTIVE =
  `Your shell already starts in the repo root of the library checkout — use relative paths ` +
  `for every command; do not cd into the repo. ` +
  `When the work is done, call report_run_result once with the final page path, a one-line ` +
  `summary, and a run retrospective: the real obstacles you hit this run and how you resolved ` +
  `them (empty if it went smoothly — never invent friction). Report the review's actual verdict ` +
  `there, including any checklist item still failing; do not describe a failing page as passing.`;

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
        `pass it with \`flue run --data '{"typeName":"…"}'\`. ` +
        `Validation said: ${parsed.issues.map((i) => i.message).join('; ')}`,
    );
  }

  // The checkout the writer reads and edits. local() binds it to this host with no
  // isolation, so keep it pointed at a directory you are willing to let the model
  // change. Creation data is the per-run input; REPO_PATH overrides when it is
  // omitted, and the process working directory is the last resort — so running from
  // inside a library checkout needs no path at all. Explicit --data wins over the
  // env var, since silently overriding a stated path would be the greater surprise.
  const projectPath = parsed.output.projectPath ?? process.env.REPO_PATH ?? process.cwd();

  // Publish the run's facts for the phase tools and role renders, neither of which
  // can reach useInitialData() (it returns undefined in a subagent render).
  // Idempotent, so repeating it on every render is harmless.
  setRunContext({
    projectPath,
    userPrompt: parsed.output.userPrompt,
    skipPhases: parsed.output.skipPhases,
  });

  // Owns useModel, so nothing here may call it again — it throws on a second call
  // in one render.
  useDocsAuthorBase();
  // cwd belongs to local(), not to useSandbox. local()'s cwd anchors the sandbox on
  // the host and defaults to process.cwd(); useSandbox's cwd only picks a directory
  // *inside* an already-anchored environment. Passing it to useSandbox left the
  // sandbox rooted in flowrite itself, so workspace discovery — AGENTS.md and
  // .agents/skills/ from the session cwd — fed the writer flowrite's own AGENTS.md
  // instead of the checkout it is documenting.
  useSandbox(local({ cwd: projectPath }));

  for (const skill of opts.skills) useSkill(skill);
  // Guarded: a phase tool's harness conversation inherits every other phase tool, so without this
  // a phase can re-enter the workflow until the delegation cap trips — which is how reviewer and
  // style_checker became unreachable. See phase-guard.ts.
  for (const tool of opts.tools) useTool(guardPhase(tool));
  // gh_query stays unguarded — an ordinary lookup any phase may legitimately need.
  useTool(createGhQueryTool(getRepoPath));
  // report_run_result is guarded on a different axis: not "is it a phase?" but "is it terminal for
  // the run?". It was exempt originally, and a phase duly filed the run's verdict mid-review.
  useTool(guardRootOnly(createReportRunResultTool(opts.label)));
  for (const role of ROLES) useSubagent(role);

  useUsageReport(opts.label);
  useInstruction(`${opts.runDirective} ${SHARED_DIRECTIVE}`);
  return opts.instructions;
}
