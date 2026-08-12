import { defineSubagent } from '@flue/runtime';
import { TIERS } from '../shared/models.ts';
import instructions from './designer.md';

/**
 * Generic documentation structure-planner, shared across document kinds. Declares
 * no tools or delegates of its own — see design-doc-structure.ts for why that
 * matters: a narrow delegate cannot see or re-invoke the design phase tool itself,
 * avoiding runaway self-recursion.
 *
 * The kind-specific structure template + result schema are injected at the
 * delegating `harness.prompt` call site (skills can't vary per call), so this role
 * stays document-kind-neutral.
 */
export function Designer() {
  return instructions;
}

export const designer = defineSubagent({
  name: 'designer',
  ...TIERS.designer,
  description: 'Turns research findings into a validated structural plan for a documentation page.',
  agent: Designer,
});
