import { defineAgentProfile } from '@flue/runtime';
import writingStyle from '../skills/writing-style/SKILL.md' with { type: 'skill' };
import { TIERS } from '../shared/models.ts';

/**
 * Reusable baseline for ZIO documentation-authoring agents. Supplies the shared
 * model and the writing-style skill. A concrete agent extends this profile and
 * adds its own instructions, tools, actions, and subagents.
 */
export const docsAuthorBase = defineAgentProfile({
  name: 'docs_author_base',
  description: 'Shared baseline for ZIO documentation authoring agents.',
  ...TIERS.writer,
  instructions: 'You author ZIO library documentation. Follow the writing-style skill for all prose.',
  skills: [writingStyle],
});
