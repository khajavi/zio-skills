import * as v from 'valibot';
import type { Check, CheckContext, ReviewItem } from './check.ts';
import { delegate } from '../shared/delegate.ts';
import { reviewSchema } from '../shared/schemas.ts';
import { authorHint } from '../shared/author-hint.ts';
// Single source of truth for the rules, shared with the writing-style skill (its SKILL.md points
// here; only the SKILL.md basename itself is barred from markdown imports by the build).
import rulesMarkdown from '../skills/writing-style/references/rules.md';

/**
 * The style rules that need reading comprehension.
 *
 * Everything absent from this list is decided by a `code` check — see src/review/code/index.ts. Rules
 * 7, 8, 16 and 20 have mechanical halves worth extracting later (link form, dot-prefixed method
 * references, imports present, the generic-phrase list); until then the model judges them whole. Rule
 * 21's mechanical half already lives in code as `style-21-form`, so what remains here is its judgement:
 * bullets for enumerable items, prose for a narrative.
 */
export const LLM_RULES = [1, 2, 3, 6, 7, 8, 9, 16, 17, 19, 20, 21, 24, 26];

/**
 * How many rules one `style_checker` call judges. A genuine trade, not a tuning detail.
 *
 * Bigger groups mean fewer delegations, and delegations are what review costs: each one takes the
 * phase's scratch conversation about two turns of a context that accumulates, so cost is turns ×
 * context and the two multiply. Smaller groups mean more attention per rule. Env-overridable so it can
 * be A/B measured on one page rather than argued about.
 */
const GROUP_SIZE = Number(process.env.STYLE_GROUP_SIZE ?? 10);

const violationSchema = v.object({
  rule: v.pipe(v.number(), v.description('The violated rule number')),
  line: v.pipe(v.number(), v.description('Line where the violation starts (from the N: prefixes)')),
  problem: v.pipe(
    v.string(),
    v.description('What is wrong, specific enough to fix without re-reading the rule'),
  ),
});
const checkResultSchema = v.object({ violations: v.array(violationSchema) });

/** Rule number → rule text, parsed once from the same file the writing-style skill serves. */
const RULE_TEXT = new Map<number, string>(
  rulesMarkdown
    .split('\n')
    .map((line) => /^(\d+)\. (.+)$/.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => [Number(match[1]), match[2]] as const),
);

const numbered = (lines: string[]): string => lines.map((line, i) => `${i + 1}: ${line}`).join('\n');

/**
 * One check owning every model-judged style rule.
 *
 * Deliberately ONE check rather than fourteen. Each delegation costs the phase's scratch conversation
 * roughly two turns of an ever-growing context, so batching is the difference between two delegations
 * and fourteen relay round-trips — the latter would be worse than the loop this replaces. `covers` is
 * what lets `only` cut work inside the check instead of merely choosing between checks: re-checking two
 * failed rules is one delegation.
 *
 * Delegates rather than judging in the scratch conversation itself. Inlining would halve the turns, but
 * the narrow role's small, clean context may be why it judges well — a quality risk no arithmetic
 * settles, so it is left to its own measured experiment.
 */
export const llmStyleCheck: Check = {
  id: 'style-llm',
  kind: 'llm',
  covers: LLM_RULES.map((rule) => `style-${rule}`),
  async run(ctx: CheckContext, only?: string[]) {
    const wanted = only ? LLM_RULES.filter((rule) => only.includes(`style-${rule}`)) : LLM_RULES;
    if (wanted.length === 0) return [];

    const groups: number[][] = [];
    for (let i = 0; i < wanted.length; i += GROUP_SIZE) groups.push(wanted.slice(i, i + GROUP_SIZE));

    const page = numbered(ctx.lines);
    const items: ReviewItem[] = [];

    for (const group of groups) {
      const label = `style_checker rules ${group.join(',')}`;
      const data = await delegate({
        harness: ctx.harness,
        log: ctx.log,
        label,
        role: 'style_checker',
        result: checkResultSchema,
        prompt: [
          `Check the page below against ONLY these writing style rules:`,
          ``,
          ...group.map((rule) => `${rule}. ${RULE_TEXT.get(rule) ?? ''}`),
          ``,
          `--- PAGE (${ctx.path}, with line numbers) ---`,
          page,
        ].join('\n'),
      });
      ctx.log.info(`${label}: ${data.violations.length} violation(s)`);

      for (const violation of data.violations) {
        // Only trust a rule number the group was actually asked about: a checker that reports rule 15
        // while judging rules 1-10 would create an item id no repeat review could narrow onto.
        const rule = group.includes(violation.rule) ? violation.rule : group[0];
        items.push({
          item: `style-${rule} @ line ${violation.line}`,
          pass: false,
          issue: violation.problem,
        });
      }
    }

    return items.length > 0
      ? items
      : [{ item: `Writing style (${wanted.length} model-judged rules)`, pass: true, issue: null }];
  },
};

/**
 * The doc-kind checklist, evaluated by the generic `reviewer` role.
 *
 * The checklist content is injected per call because skills are role-owned and cannot vary per
 * delegated task — the same source-of-truth split the phases already used.
 */
export function checklistCheck(opts: {
  checklistDoc: string;
  /** Noun for the delegation prompt, e.g. 'data type reference page'. */
  promptNoun: string;
  /** Fenced header label, e.g. 'REFERENCE PAGE'. */
  headerLabel: string;
}): Check {
  return {
    id: 'checklist',
    kind: 'llm',
    async run(ctx) {
      const data = await delegate({
        harness: ctx.harness,
        log: ctx.log,
        label: 'reviewer',
        role: 'reviewer',
        result: reviewSchema,
        prompt: [
          `Evaluate the ${opts.promptNoun} below against every item in this checklist:`,
          ``,
          opts.checklistDoc,
          // Before the content delimiter, so the hint reads as reviewer guidance rather than as part
          // of the page under review.
          authorHint(),
          ``,
          `--- ${opts.headerLabel} (${ctx.path}) ---`,
          ctx.content,
        ].join('\n'),
      });
      ctx.log.info(`reviewer: ${data.items.filter((item) => !item.pass).length} failing item(s)`);
      return data.items;
    },
  };
}
