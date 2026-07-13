import { defineAgentProfile } from '@flue/runtime';
import writingStyle from '../skills/writing-style/SKILL.md' with { type: 'skill' };
import mdocConventions from '../skills/mdoc-conventions/SKILL.md' with { type: 'skill' };
import { TIERS } from '../shared/models.ts';
import instructions from './drafter.md' with { type: 'markdown' };

/**
 * Generic documentation-prose writer, shared across document kinds. No
 * actions/subagents of its own — see design-tutorial-structure.ts for why that matters.
 *
 * The kind-specific structure/template is injected into the task prompt by the
 * calling action (a subagent's skills are profile-owned and cannot vary per
 * `session.task` call), so this profile carries only the shared writing-style +
 * mdoc-conventions skills and a voice-neutral persona.
 */
export const drafter = defineAgentProfile({
  name: 'drafter',
  ...TIERS.writer,
  description:
    'Writes a complete ZIO documentation page as Docusaurus markdown from a given structure and research findings.',
  skills: [writingStyle, mdocConventions],
  instructions,
});
