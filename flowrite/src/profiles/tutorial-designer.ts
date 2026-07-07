import { defineAgentProfile } from '@flue/runtime';
import tutorialStructure from '../skills/tutorial-structure/SKILL.md' with { type: 'skill' };
import { TIERS } from '../shared/models.ts';
import instructions from './tutorial-designer.md' with { type: 'markdown' };

/**
 * Narrow, single-purpose profile for `design_tutorial_structure`. Deliberately
 * has no actions/subagents of its own: delegating to it (instead of reopening a
 * session on the calling agent) means it cannot see or re-invoke
 * design_tutorial_structure itself, which is what caused runaway self-recursion
 * when the action used a bare harness.session() on the tutorial-writer agent.
 */
export const tutorialDesigner = defineAgentProfile({
  name: 'tutorial_designer',
  ...TIERS.designer,
  description: 'Turns deep-research answers into a validated, linear tutorial section plan.',
  skills: [tutorialStructure],
  instructions,
});
