import { type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';
import moduleRefWriter from '../agents/module-ref-writer.ts';
import { installVerboseObserver } from '../shared/verbose-observer.ts';
import { defineDocsWorkflow, skipPhasesField } from '../shared/docs-workflow.ts';

/**
 * Finite wrapper around the module-ref-writer agent for CI, scheduled, or batch
 * runs. Takes the library checkout (`projectPath`) and the `moduleName`, plus an
 * optional `layout` override. The agent resolves its sandbox cwd from REPO_PATH,
 * so the run sets that from projectPath before opening a session. Mirrors
 * write-data-type-ref.ts.
 */
export const route: WorkflowRouteHandler = async (_c, next) => next();

// FLUE_VERBOSE_TOOLS=1 opts into full tool/subagent call detail.
installVerboseObserver();

export default defineDocsWorkflow({
  label: 'write-module-ref',
  agent: moduleRefWriter,
  input: v.object({
    projectPath: v.pipe(v.string(), v.description('Absolute path to the ZIO library checkout to document')),
    moduleName: v.pipe(v.string(), v.description('The module to document, e.g. "http-model" or "resource-management"')),
    layout: v.pipe(
      v.optional(v.picklist(['flat', 'hierarchical'])),
      v.description('Force the page layout; omit to let the design phase decide via the auto-rule.'),
    ),
    userPrompt: v.pipe(
      v.optional(v.string()),
      v.description('Optional free-form hint to steer the run, e.g. scope, emphasis, or known gotchas.'),
    ),
    skipPhases: skipPhasesField(
      'Phases to skip (only code-gated phases; mdoc verify is agent-driven and always runs). ' +
        'Skipping a head-phase prefix resumes a run whose artifacts already exist, ' +
        'e.g. ["research", "design", "write"] runs only the examples/integrate/review tail.',
    ),
  }),
  buildPrompt: (input) =>
    `Write a complete, compile-verified module reference for the module: ${input.moduleName}. ` +
    (input.layout ? `Use the "${input.layout}" layout (pass it as layoutOverride to design). ` : '') +
    (input.userPrompt ? `Author hint to steer this run: ${input.userPrompt} ` : '') +
    `Your shell already starts in the repo root of the library checkout — use relative paths for every command; do not cd into the repo. ` +
    `Run the full flow (research → design → write module page → per-type subpages if hierarchical → ` +
    `examples → mdoc verify → integrate → review; review covers per-type method coverage + writing ` +
    `style + the module checklist). ` +
    `Report the final page path, a one-line summary, and a run retrospective: the real obstacles ` +
    `you hit this run and how you resolved them (empty if it went smoothly — never invent friction).`,
});
