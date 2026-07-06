import { defineAgentProfile } from '@flue/runtime';
import tutorialChecklist from '../skills/tutorial-checklist/SKILL.md' with { type: 'skill' };
import { TIERS } from '../shared/models.ts';

/**
 * Narrow, single-purpose profile for `review_against_checklist`. No
 * actions/subagents of its own — see tutorial-designer.ts for why that matters.
 */
export const tutorialReviewer = defineAgentProfile({
  name: 'tutorial_reviewer',
  ...TIERS.reviewer,
  description: 'Evaluates a written tutorial against the tutorial-checklist and reports per-item pass/fail.',
  skills: [tutorialChecklist],
  instructions: [
    'You evaluate tutorials against the tutorial-checklist skill.',
    'Load the tutorial-checklist skill.',
    'Evaluate the given tutorial against every checklist item.',
    'Return each item with pass/fail; when failing, give a specific, actionable issue.',
    'Set passed=true only if every item passes.',
  ].join('\n'),
});
