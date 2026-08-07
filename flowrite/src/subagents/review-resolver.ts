import { defineSubagent, useSkill } from '@flue/runtime';
import writingStyle from '../skills/writing-style/SKILL.md';
import { TIERS } from '../shared/models.ts';
import instructions from './review-resolver.md';

/**
 * Review-comment fixer. Resolves human `<!-- REVIEW ... -->` comments embedded
 * in an article: applies each directed fix (document-wide when the comment
 * states a general rule), strips the markers, audits each general rule against
 * the writing-style skill, and mdoc-verifies the result. Distinct from the
 * reviewer role, which only evaluates and never edits. See review-resolver.md.
 */
export function ReviewResolver() {
  useSkill(writingStyle);
  return instructions;
}

export const reviewResolver = defineSubagent({
  name: 'review_resolver',
  ...TIERS.reviewer,
  description:
    'Resolves embedded <!-- REVIEW --> comments in an article: applies the fixes in place, strips the markers, and reports which rule each comment enforced.',
  agent: ReviewResolver,
});
