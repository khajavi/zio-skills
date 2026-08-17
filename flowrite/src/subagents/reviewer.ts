import { defineSubagent } from '@flue/runtime';
import { TIERS } from '../runtime/models.ts';
import instructions from './reviewer.md';

/**
 * Generic documentation reviewer, shared across document kinds. Declares no tools or delegates of its
 * own, so it cannot re-enter the pipeline that called it.
 *
 * Unlike the drafter and designer, this role does NOT read its checklist at render time: `review_page`
 * is the last remaining phase tool, and it still pastes the kind's checklist into the delegation
 * prompt. Leaving that alone is deliberate — it is the one role whose result TypeScript holds, for
 * recordedVerdict().
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
