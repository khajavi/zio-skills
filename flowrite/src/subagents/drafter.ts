import { defineSubagent, useSkill } from '@flue/runtime';
import writingStyle from '../skills/writing-style/SKILL.md';
import mdocConventions from '../skills/mdoc-conventions/SKILL.md';
import { TIERS } from '../runtime/models.ts';
import instructions from './drafter.md';

/**
 * Generic documentation-prose writer, shared across document kinds. Declares no
 * tools or delegates of its own — see design-doc-structure.ts for why that
 * matters.
 *
 * The kind-specific structure/template is injected into the delegation prompt by
 * the calling phase tool (a delegate's skills are role-owned and cannot vary per
 * call), so this role carries only the shared writing-style + mdoc-conventions
 * skills and a voice-neutral persona.
 */
export function Drafter() {
  useSkill(writingStyle);
  useSkill(mdocConventions);
  return instructions;
}

export const drafter = defineSubagent({
  name: 'drafter',
  ...TIERS.writer,
  description:
    'Writes a complete ZIO documentation page as Docusaurus markdown from a given structure and research findings.',
  agent: Drafter,
});
