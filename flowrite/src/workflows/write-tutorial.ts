import { type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';
import tutorialWriter from '../agents/tutorial-writer.ts';
import { installVerboseObserver } from '../shared/verbose-observer.ts';
import { defineDocsWorkflow, skipPhasesField } from '../shared/docs-workflow.ts';

/**
 * Finite wrapper around the tutorial-writer agent for CI, scheduled, or batch
 * runs. Takes the library checkout (`projectPath`) and the `topic`. The agent
 * resolves its sandbox cwd from REPO_PATH, so the run sets that from
 * projectPath before opening a session.
 */
export const route: WorkflowRouteHandler = async (_c, next) => next();

// FLUE_VERBOSE_TOOLS=1 opts into full tool/subagent call detail.
installVerboseObserver();

export default defineDocsWorkflow({
  label: 'write-tutorial',
  agent: tutorialWriter,
  input: v.object({
    projectPath: v.pipe(v.string(), v.description('Absolute path to the ZIO library checkout to document')),
    topic: v.pipe(v.string(), v.description('Tutorial title or topic description')),
    skipPhases: skipPhasesField(
      'Phases to skip. Skipping a head-phase prefix resumes a run whose artifacts already exist, ' +
        'e.g. ["research", "design", "write", "write-examples"] runs only integrate + review.',
    ),
  }),
  buildPrompt: (input) =>
    `Write a complete, compile-verified tutorial for: ${input.topic}. ` +
    `The library checkout (repo root) is at ${input.projectPath}. ` +
    `Run the full flow (research → design → write → examples → mdoc verify → integrate → review). ` +
    `Report the final tutorial file path, a one-line summary, and a run retrospective: ` +
    `the real obstacles you hit this run and how you resolved them (empty if it went smoothly — ` +
    `never invent friction).`,
});
