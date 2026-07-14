import { type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';
import dataTypeRefWriter from '../agents/data-type-ref-writer.ts';
import { installVerboseObserver } from '../shared/verbose-observer.ts';
import { defineDocsWorkflow, skipPhasesField } from '../shared/docs-workflow.ts';

/**
 * Finite wrapper around the data-type-ref-writer agent for CI, scheduled, or
 * batch runs. Takes the library checkout (`projectPath`) and the `typeName`.
 * The agent resolves its sandbox cwd from REPO_PATH, so the run sets that from
 * projectPath before opening a session. Mirrors write-tutorial.ts.
 */
export const route: WorkflowRouteHandler = async (_c, next) => next();

// FLUE_VERBOSE_TOOLS=1 opts into full tool/subagent call detail.
installVerboseObserver();

export default defineDocsWorkflow({
  label: 'write-data-type-ref',
  agent: dataTypeRefWriter,
  input: v.object({
    projectPath: v.pipe(v.string(), v.description('Absolute path to the ZIO library checkout to document')),
    typeName: v.pipe(v.string(), v.description('The data type to document, e.g. "Chunk"')),
    skipPhases: skipPhasesField(
      'Phases to skip (only code-gated phases; mdoc verify is agent-driven and always runs). ' +
        'Skipping a head-phase prefix resumes a run whose artifacts already exist, ' +
        'e.g. ["research", "design", "write"] runs only the examples/integrate/review tail.',
    ),
  }),
  buildPrompt: (input) =>
    `Write a complete, compile-verified data type reference page for: ${input.typeName}. ` +
    `The library checkout (repo root) is at ${input.projectPath}. ` +
    `Run the full flow (research → design → write → examples → mdoc verify → integrate → ` +
    `review; review covers method coverage + writing style + the checklist). ` +
    `Report the final page path, a one-line summary, and a run retrospective: the real obstacles ` +
    `you hit this run and how you resolved them (empty if it went smoothly — never invent friction).`,
});
