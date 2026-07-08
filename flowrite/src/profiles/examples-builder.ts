import { defineAgentProfile } from '@flue/runtime';
import { TIERS } from '../shared/models.ts';
import { createCompileExamplesTool, createRunExampleTool } from '../tools/repo-tools.ts';
import instructions from './examples-builder.md' with { type: 'markdown' };

// REPO_PATH is required before `flue run` starts (see tutorial-writer.ts's own cwd check).
const compileExamples = createCompileExamplesTool(process.env.REPO_PATH!);
const runExample = createRunExampleTool(process.env.REPO_PATH!);

/**
 * Companion-examples specialist. Creates one runnable example per tutorial
 * concept plus a complete example in a DECOUPLED `<library>-examples` sbt build
 * (RootProject-composed, independent per-tutorial subprojects), then compiles,
 * runs, and formats them via the parent's sandbox shell. See examples-builder.md.
 */
export const examplesBuilder = defineAgentProfile({
  name: 'examples_builder',
  ...TIERS.examples,
  description:
    'Creates and compiles companion example files for a tutorial (one per concept + a complete example). Use after the tutorial draft exists.',
  tools: [compileExamples, runExample],
  instructions,
});
