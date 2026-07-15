import { defineAgentProfile } from '@flue/runtime';
import { TIERS } from '../shared/models.ts';
import instructions from './designer.md' with { type: 'markdown' };

/**
 * Generic documentation structure-planner, shared across document kinds. No
 * actions/subagents of its own — see design-tutorial-structure.ts for why that
 * matters: delegating to a narrow profile (instead of reopening a session on the
 * calling agent) means it cannot see or re-invoke the design action itself,
 * avoiding runaway self-recursion.
 *
 * The kind-specific structure template + result schema are injected at the
 * session.task call site (skills can't vary per call), so this profile stays
 * document-kind-neutral.
 */
export const designer = defineAgentProfile({
  name: 'designer',
  ...TIERS.designer,
  description: 'Turns research findings into a validated structural plan for a documentation page.',
  instructions,
});
