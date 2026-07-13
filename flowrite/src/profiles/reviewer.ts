import { defineAgentProfile } from '@flue/runtime';
import { TIERS } from '../shared/models.ts';
import instructions from './reviewer.md' with { type: 'markdown' };

/**
 * Generic documentation reviewer, shared across document kinds. No
 * actions/subagents of its own — see design-tutorial-structure.ts for why that matters.
 *
 * The kind-specific checklist is injected into the task prompt by the calling
 * action (skills are profile-owned and cannot vary per `session.task` call), so
 * this profile stays document-kind-neutral.
 */
export const reviewer = defineAgentProfile({
  name: 'reviewer',
  ...TIERS.reviewer,
  description:
    'Evaluates a written documentation page against a given checklist and reports per-item pass/fail.',
  instructions,
});
