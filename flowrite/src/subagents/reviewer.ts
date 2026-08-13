import { defineSubagent } from '@flue/runtime';
import { TIERS } from '../runtime/models.ts';
import instructions from './reviewer.md';

/**
 * Generic documentation reviewer, shared across document kinds. Declares no tools
 * or delegates of its own — see design-doc-plan.ts for why that matters.
 *
 * The kind-specific checklist is injected into the delegation prompt by the
 * calling phase tool (skills are role-owned and cannot vary per call), so this
 * role stays document-kind-neutral.
 */
export function Reviewer() {
  return instructions;
}

export const reviewer = defineSubagent({
  name: 'reviewer',
  ...TIERS.reviewer,
  description:
    'Evaluates a written documentation page against a given checklist and reports per-item pass/fail.',
  agent: Reviewer,
});
