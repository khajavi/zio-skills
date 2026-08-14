import { defineSubagent } from '@flue/runtime';
import { TIERS } from '../runtime/models.ts';
import { docKind } from '../runtime/run-context.ts';
import { structureBlock } from '../runtime/kind-docs.ts';
import instructions from './designer.md';

/**
 * Generic documentation planner, shared across document kinds. Declares
 * no tools or delegates of its own — see design-doc-plan.ts for why that
 * matters: a narrow delegate cannot see or re-invoke the design phase tool itself,
 * avoiding runaway self-recursion.
 *
 * The kind's structure template is read here, at this render, via `docKind()` — see drafter.ts for
 * why that beats both a skill mount and a caller-pasted prompt. The result SCHEMA still comes from
 * the delegating call site, because that genuinely does vary per call and cannot be derived from the
 * kind alone: a module design takes a layout override, a data-type design does not.
 */
export function Designer() {
  return [instructions, ``, structureBlock(docKind())].join('\n');
}

export const designer = defineSubagent({
  name: 'designer',
  ...TIERS.designer,
  description: 'Turns research findings into a validated plan for a documentation page.',
  agent: Designer,
});
