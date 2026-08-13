import { useInstruction, useModel, useSkill } from '@flue/runtime';
import writingStyle from '../skills/writing-style/SKILL.md';
import { TIERS } from './models.ts';

/**
 * Reusable baseline for ZIO documentation-authoring agents: the shared model tier
 * and the writing-style skill. A concrete writer calls this first, then adds its
 * own instructions, tools, and delegates.
 *
 * Was a `defineAgentProfile` used as `profile:`. Flue 2 removed profiles in favour
 * of custom hooks — a plain function that calls hooks, composing exactly as the
 * agent body would. `useModel` is owned here, so a caller must not call it again
 * (it throws on a second call in one render).
 */
export function useDocsAuthorBase(): void {
  useModel(TIERS.writer.model, { thinkingLevel: TIERS.writer.thinkingLevel });
  useSkill(writingStyle);
  useInstruction('You author ZIO library documentation. Follow the writing-style skill for all prose.');
}
