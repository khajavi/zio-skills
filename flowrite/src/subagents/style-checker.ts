import { defineSubagent } from '@flue/runtime';
import { TIERS } from '../runtime/models.ts';
import instructions from './style-checker.md';

/**
 * Narrow, single-purpose role for the detection loop in `fix_writing_style`.
 * No skills: the phase tool passes the rule text verbatim in each prompt, so the
 * rules under check are always in context (never left to a skill load).
 */
export function StyleChecker() {
  return instructions;
}

export const styleChecker = defineSubagent({
  name: 'style_checker',
  ...TIERS.reviewer,
  description: 'Checks a documentation page against a given group of writing style rules and reports violations.',
  agent: StyleChecker,
});
