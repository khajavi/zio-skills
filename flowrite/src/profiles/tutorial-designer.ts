import { defineAgentProfile } from '@flue/runtime';
import tutorialStructure from '../skills/tutorial-structure/SKILL.md' with { type: 'skill' };

/**
 * Narrow, single-purpose profile for `design_tutorial_structure`. Deliberately
 * has no actions/subagents of its own: delegating to it (instead of reopening a
 * session on the calling agent) means it cannot see or re-invoke
 * design_tutorial_structure itself, which is what caused runaway self-recursion
 * when the action used a bare harness.session() on the tutorial-writer agent.
 */
export const tutorialDesigner = defineAgentProfile({
  name: 'tutorial_designer',
  description: 'Turns deep-research answers into a validated, linear tutorial section plan.',
  skills: [tutorialStructure],
  instructions: [
    'You design learning-oriented tutorial structures from research answers.',
    'Follow the tutorial-structure skill\'s template and section-design rules.',
    'Produce 3-6 strictly linear sections, one new concept each, ordered by dependency',
    '(simplest "hello world" first, then one layer of complexity per section).',
    'State 3-5 learning objectives, the prerequisites, a show-moment per section,',
    'and the single aha moment. No branching.',
  ].join('\n'),
});
