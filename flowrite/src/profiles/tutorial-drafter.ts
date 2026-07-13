import { defineAgentProfile } from '@flue/runtime';
import writingStyle from '../skills/writing-style/SKILL.md' with { type: 'skill' };
import mdocConventions from '../skills/mdoc-conventions/SKILL.md' with { type: 'skill' };
import tutorialStructure from '../skills/tutorial-structure/SKILL.md' with { type: 'skill' };
import instructions from './tutorial-drafter.md' with { type: 'markdown' };

/**
 * Narrow, single-purpose profile for `write_tutorial_draft`. No actions/subagents
 * of its own — see tutorial-designer.ts for why that matters.
 */
export const tutorialDrafter = defineAgentProfile({
  name: 'tutorial_drafter',
  description: 'Writes a complete learning-oriented tutorial as Docusaurus markdown from a section plan.',
  skills: [writingStyle, mdocConventions, tutorialStructure],
  instructions,
});
