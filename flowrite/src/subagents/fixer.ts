import { defineSubagent } from '@flue/runtime';
import { TIERS } from '../runtime/models.ts';
import instructions from './fixer.md';

/**
 * Applies fixes `reviewer` already composed — never invents one, never re-derives one. Declares no
 * tools or delegates of its own, so it cannot re-enter the pipeline that called it.
 *
 * Deliberately carries nothing else: no mounted skill, no docKind()-selected template. Every other
 * role that composes or judges prose (drafter, reviewer, designer) reads its kind's structure/
 * checklist/style material at render time — fixer doesn't, because it isn't composing or judging
 * anything. `reviewer` already has that material loaded at the moment it writes the fix statement
 * fixer will apply; duplicating it here would pay for a capability this role never uses. Same
 * reasoning killed fixer's own mdoc self-check: the root unconditionally re-runs mdoc after every
 * fixer call (see composition.ts's SHARED_DIRECTIVE), so a second check inside fixer itself would be
 * an unmeasured, redundant cost — exactly what AGENTS.md's tool-vs-instruction rule says to cut.
 *
 * Took over "you fix" from the root agent — see every kind instruction's fact-check/review steps,
 * which used to name the root as the one who corrects a page.
 */
export function Fixer() {
  return instructions;
}

export const fixer = defineSubagent({
  name: 'fixer',
  ...TIERS.fixer,
  description:
    'Applies fixes reviewer already composed: given a location and the exact corrected statement for ' +
    'it, edits the page to match — verbatim, no re-deriving, no rephrasing. Never edits the library ' +
    'source. Use after a reviewer delegation reports anything failing.',
  agent: Fixer,
});
