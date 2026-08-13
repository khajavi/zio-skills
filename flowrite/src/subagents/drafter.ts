import { defineSubagent, useSkill } from '@flue/runtime';
import mdocConventions from '../skills/mdoc-conventions/SKILL.md';
import { TIERS } from '../runtime/models.ts';
import instructions from './drafter.md';

/**
 * Generic documentation-prose writer, shared across document kinds. Declares no
 * tools or delegates of its own — see design-doc-plan.ts for why that
 * matters.
 *
 * The kind-specific section template is injected into the delegation prompt by the calling phase
 * tool, because a delegate's render takes no arguments and this template is needed on every call.
 *
 * `mdoc-conventions` is mounted rather than injected because its content lives in its `SKILL.md`
 * with no `references/` file behind it — the mount is its only delivery path.
 *
 * `writing-style` used to be mounted here as well, and that was double delivery: write-doc.ts pastes
 * `writing-style/references/rules.md` into this role's prompt, while the mounted `SKILL.md` is a
 * pointer whose body says "the complete numbered rule list is provided verbatim in your task input".
 * So the drafter kept spending an activation round-trip to be told the rules were in the prompt it
 * was already reading — 2 round-trips in write-data-type-ref-turn20 (2 drafter calls) and 5 in
 * write-module-ref-turn5 (5 calls), each re-sending this delegate's whole accumulated context.
 *
 * The root agent keeps its own `writing-style` mount (docs-author-base.ts): nothing injects the rules
 * there, so for the root the mount is the only access, and it does activate it.
 */
export function Drafter() {
  useSkill(mdocConventions);
  return instructions;
}

export const drafter = defineSubagent({
  name: 'drafter',
  ...TIERS.writer,
  description:
    'Writes a complete ZIO documentation page as Docusaurus markdown from a given plan and research findings.',
  agent: Drafter,
});
