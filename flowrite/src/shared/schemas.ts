import * as v from 'valibot';

/**
 * A self-authored run retrospective: the obstacles the agent actually hit and
 * how it got past them, so recurring friction can be mined across runs (each
 * turn's insights.json in the archive) to drive instruction/tool improvements.
 * Phases are listed in run order (research → design → write → examples → mdoc →
 * integrate → review). Shared by every write-* workflow.
 */
export const insightsSchema = v.array(
  v.object({
    phase: v.picklist(['research', 'design', 'write', 'examples', 'mdoc', 'integrate', 'review']),
    obstacle: v.pipe(v.string(), v.description('What actually went wrong or slowed you down this run')),
    resolution: v.pipe(v.string(), v.description('How you got past it')),
    suggestedFix: v.nullable(
      v.pipe(
        v.string(),
        v.description('A concrete instruction/tool/schema change that would prevent this next time, or null'),
      ),
    ),
  }),
);

/**
 * Per-item pass/fail from a checklist review. `passed` is true only when every
 * item passes. Shared by every review-* action.
 */
export const reviewSchema = v.object({
  passed: v.pipe(v.boolean(), v.description('true only when every checklist item passes')),
  items: v.array(
    v.object({
      item: v.string(),
      pass: v.boolean(),
      issue: v.nullable(v.pipe(v.string(), v.description('Specific problem when pass is false'))),
    }),
  ),
});
