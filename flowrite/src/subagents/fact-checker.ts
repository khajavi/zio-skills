import { defineSubagent } from '@flue/runtime';
import { TIERS } from '../runtime/models.ts';
import instructions from './fact-checker.md';

/**
 * Checks one section of a finished page against the library's real sources and reports the
 * mismatches. Declares no tools or delegates of its own, so it cannot re-enter the pipeline that
 * called it.
 *
 * It needs no tool declaration to do its job: a delegate inherits the parent's sandbox and its
 * harness tools — read, grep, glob, bash — from the shared environment (guide/subagents.md, "It
 * inherits the parent's environment"). Declaring anything more would only give it a way back into
 * the pipeline.
 *
 * Unlike the drafter and designer, this role reads no kind-specific template at render time. There
 * is nothing per-kind about it: a tutorial's claim about a return type is checked exactly like a
 * reference page's, and the section under test arrives in the prompt either way. The one thing it
 * does need per call — which page, which subject, which source roots — cannot come from a render,
 * because a delegate sees nothing of the parent's conversation.
 */
export function FactChecker() {
  return instructions;
}

export const factChecker = defineSubagent({
  name: 'fact_checker',
  ...TIERS.factChecker,
  description:
    'Verifies the factual claims in one section of a documentation page against the library source, ' +
    'and reports each mismatch with citations to both the page and the source.',
  agent: FactChecker,
});
