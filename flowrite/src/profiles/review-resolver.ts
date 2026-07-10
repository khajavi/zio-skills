import { defineAgentProfile } from '@flue/runtime';
import writingStyle from '../skills/writing-style/SKILL.md' with { type: 'skill' };
import { TIERS } from '../shared/models.ts';
import { createMdocCompileTool } from '../tools/repo-tools.ts';
import instructions from './review-resolver.md' with { type: 'markdown' };

// REPO_PATH is required before `flue run` starts (see tutorial-writer.ts's own cwd check).
const mdocCompile = createMdocCompileTool(process.env.REPO_PATH!);

/**
 * Review-comment fixer. Resolves human `<!-- REVIEW ... -->` comments embedded
 * in an article: applies each directed fix (document-wide when the comment
 * states a general rule), strips the markers, audits each general rule against
 * the writing-style skill, and mdoc-verifies the result. Distinct from
 * tutorial_reviewer, which only evaluates and never edits. See review-resolver.md.
 */
export const reviewResolver = defineAgentProfile({
  name: 'review_resolver',
  ...TIERS.reviewer,
  description:
    'Resolves embedded <!-- REVIEW --> comments in an article: applies the fixes in place, strips the markers, and reports which rule each comment enforced.',
  skills: [writingStyle],
  tools: [mdocCompile],
  instructions,
});
