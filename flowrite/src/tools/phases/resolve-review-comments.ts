import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { authorHint } from '../../runtime/run-context.ts';
import { delegate } from '../../runtime/delegate.ts';

export const resolveReviewCommentsOutput = v.object({
  path: v.pipe(v.string(), v.description('Path to the resolved article, relative to the repo root')),
  resolved: v.array(
    v.object({
      type: v.pipe(v.string(), v.description('The comment\'s TYPE: value, or "general" when absent')),
      instruction: v.pipe(v.string(), v.description('What the comment asked for, condensed')),
      scope: v.pipe(
        v.picklist(['location', 'document']),
        v.description('location = fixed only the anchored spot; document = general rule applied doc-wide'),
      ),
      occurrencesFixed: v.pipe(v.number(), v.description('How many places were edited for this comment')),
      // Rule audit — set for general-rule comments (both null for location-scoped):
      existingRule: v.nullable(
        v.pipe(
          v.string(),
          v.description('Existing instruction this comment enforced, e.g. "writing-style #8", when one already covers it'),
        ),
      ),
      suggestedRule: v.nullable(
        v.pipe(
          v.string(),
          v.description('When no existing rule covers it: suggested new rule text to add to the writing-style skill'),
        ),
      ),
    }),
  ),
  unresolved: v.array(
    v.object({
      instruction: v.string(),
      reason: v.pipe(v.string(), v.description('Why this comment could not be resolved; its marker was left in place')),
    }),
  ),
  mdocOk: v.pipe(v.boolean(), v.description('true when scoped mdoc passed on the final article')),
  summary: v.string(),
});

// Kept in sync with resolve-review-comments.ts (the standalone workflow) deliberately —
// same delegation prompt whether the resolver runs inside a pipeline or alone.
export const resolveReviewPrompt = (articlePath: string): string =>
  `Resolve the human <!-- REVIEW --> comments embedded in the article at ${articlePath}. ` +
  `Apply each directed fix in place (document-wide when a comment states a general rule), ` +
  `strip the resolved markers, audit each general rule against existing instructions, and ` +
  `verify the result with scoped mdoc.`;

/**
 * Resolve human `<!-- REVIEW ... -->` comments embedded in an article. Not
 * skip-gated: this action is on-demand (a human must have left comments), never
 * part of the scripted pipeline flow. Registered on the host agent so the
 * resolve-review workflow — and, later, the pipeline — can reach the
 * review_resolver subagent.
 */
export const resolveReviewComments = defineTool({
  name: 'resolve_review_comments',
  description:
    'Resolve embedded <!-- REVIEW --> comments in an article: apply the fixes in place and strip the markers.',
  harness: true,
  input: v.object({
    articlePath: v.pipe(
      v.string(),
      v.description('Path to the article markdown with embedded REVIEW comments, e.g. docs/guides/schedule.md'),
    ),
  }),
  output: resolveReviewCommentsOutput,
  async run({ harness, data, log }) {
    log.info(`Resolving review comments in: ${data.articlePath}`);
    // Delegates to the review_resolver subagent — see design-doc-plan.ts
    // for why prompting the calling agent's own conversation is unsafe here.
    const resolved = await delegate({
      harness,
      log,
      label: 'review_resolver',
      role: 'review_resolver',
      result: resolveReviewCommentsOutput,
      prompt: resolveReviewPrompt(data.articlePath) + authorHint(),
    });
    return { output: resolved };
  },
});
