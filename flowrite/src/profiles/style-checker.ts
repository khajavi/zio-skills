import { defineAgentProfile } from '@flue/runtime';
import { TIERS } from '../shared/models.ts';
import instructions from './style-checker.md' with { type: 'markdown' };

/**
 * Narrow, single-purpose profile for the detection loop in `fix_writing_style`.
 * No skills: the action passes the rule text verbatim in each prompt, so the
 * rules under check are always in context (never left to a skill load).
 */
export const styleChecker = defineAgentProfile({
  name: 'style_checker',
  ...TIERS.reviewer,
  description: 'Checks a documentation page against a given group of writing style rules and reports violations.',
  instructions,
});
