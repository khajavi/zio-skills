import { defineAgentProfile } from '@flue/runtime';
import { TIERS } from '../shared/models.ts';
import { createCompileExamplesTool } from '../tools/repo-tools.ts';
import instructions from './examples-builder.md' with { type: 'markdown' };

// REPO_PATH is required before `flue run` starts (see tutorial-writer.ts's own cwd check).
const compileExamples = createCompileExamplesTool(process.env.REPO_PATH!);

/**
 * Companion-examples specialist. Creates one runnable example per tutorial
 * concept plus a complete example, then compiles and formats them using the
 * library's sbt build via the parent's sandbox shell.
 */
export const examplesBuilder = defineAgentProfile({
  name: 'examples_builder',
  ...TIERS.examples,
  description:
    'Creates and compiles companion example files for a tutorial (one per concept + a complete example). Use after the tutorial draft exists.',
  tools: [compileExamples],
  instructions,
});
