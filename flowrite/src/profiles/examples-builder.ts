import { defineAgentProfile } from '@flue/runtime';
import { TIERS } from '../shared/models.ts';
import instructions from './examples-builder.md' with { type: 'markdown' };

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
  instructions,
});
