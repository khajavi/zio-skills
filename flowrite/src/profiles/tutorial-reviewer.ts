import { defineAgentProfile } from '@flue/runtime';
import tutorialChecklist from '../skills/tutorial-checklist/SKILL.md' with { type: 'skill' };
import writingStyle from '../skills/writing-style/SKILL.md' with { type: 'skill' };
import { TIERS } from '../shared/models.ts';
import instructions from './tutorial-reviewer.md' with { type: 'markdown' };

/**
 * Narrow, single-purpose profile for `review_against_checklist`. No
 * actions/subagents of its own — see tutorial-designer.ts for why that matters.
 */
export const tutorialReviewer = defineAgentProfile({
  name: 'tutorial_reviewer',
  ...TIERS.reviewer,
  description: 'Evaluates a written tutorial against the tutorial-checklist and reports per-item pass/fail.',
  skills: [tutorialChecklist, writingStyle],
  instructions,
});
