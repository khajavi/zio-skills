import * as v from 'valibot';
import type { FlueHarness, FlueLogger } from '@flue/runtime';
import { delegate } from './delegate.ts';
// Single source of truth for the rules, shared with the writing-style
// skill (its SKILL.md points here; only the SKILL.md basename itself is
// barred from markdown imports by the build).
import rulesMarkdown from '../skills/writing-style/references/rules.md';

export const violationSchema = v.object({
  rule: v.pipe(v.number(), v.description('The violated rule number')),
  line: v.pipe(v.number(), v.description('Line where the violation starts (from the N: prefixes)')),
  problem: v.pipe(v.string(), v.description('What is wrong, specific enough to fix without re-reading the rule')),
});

const checkResultSchema = v.object({ violations: v.array(violationSchema) });
export type Violation = v.InferOutput<typeof violationSchema>;

// Parse "N. **rule text**" lines out of the imported rules file once at module
// init, then chunk into groups so no checker call has to hold every rule at once. The count is
// derived, never hardcoded: rules 26-28 were added at some point and left three comments and one
// user-visible review label still claiming 25.
const RULES: { n: number; text: string }[] = rulesMarkdown
  .split('\n')
  .map((line) => /^(\d+)\. (.+)$/.exec(line))
  .filter((m): m is RegExpExecArray => m !== null)
  .map((m) => ({ n: Number(m[1]), text: m[2] }));

/**
 * How many rules one `style_checker` call judges. A genuine trade, not a tuning detail.
 *
 * Bigger groups mean fewer delegations, and delegations are what review costs: each one takes the
 * coordinator ~2 turns of a conversation that *accumulates* (the harness continues one scratch
 * conversation across calls, growing 18.6k → 143k tokens in a measured run), so cost is turns ×
 * context and the two multiply. At 28 rules, 5 gives 6 delegations per detection round; 10 gives 3.
 *
 * Smaller groups mean more attention per rule. The plausible cost of going bigger is a missed
 * violation — a cheaper review that is also a weaker one — so this is env-overridable to be
 * A/B measured on one page rather than argued about.
 */
const GROUP_SIZE = Number(process.env.STYLE_GROUP_SIZE ?? 10);
const RULE_GROUPS: (typeof RULES)[] = [];
for (let i = 0; i < RULES.length; i += GROUP_SIZE) {
  RULE_GROUPS.push(RULES.slice(i, i + GROUP_SIZE));
}

// Map each rule number to its group index, so the fixer can batch a round's
// violations by group (one fix pass per group) instead of one edit per violation.
const RULE_TO_GROUP = new Map<number, number>();
RULE_GROUPS.forEach((group, gi) => group.forEach((r) => RULE_TO_GROUP.set(r.n, gi)));
const ruleGroupIndex = (rule: number): number => RULE_TO_GROUP.get(rule) ?? 0;

// Detection runs once more than fixing, so the last fix pass is always verified.
// Default 1 fix pass; override per run with MAX_FIX_ROUNDS=n.
const MAX_FIX_ROUNDS = Number(process.env.MAX_FIX_ROUNDS ?? 1);

/** How many rules the loop checks. Derived from the rules file, so a label can never go stale. */
export const RULE_COUNT = RULES.length;

/**
 * Detect and fix writing-style violations in a documentation page.
 *
 * Detection is a code-owned loop — every rule group is checked by a delegated
 * `style_checker` task each round, so coverage of every rule never depends
 * on the model remembering a checklist. Fixing is batched by rule group: one
 * delegated `style_fixer` task per group with violations, each reading the page
 * once and applying all of that group's fixes in a single pass. This keeps page
 * re-reads at O(groups) instead of the O(violations) cost of fixing one at a
 * time. The re-detection round is the ground truth that the fixes landed and
 * the safety net that catches anything a batch skipped.
 */
export async function runStyleLoop(
  harness: FlueHarness,
  path: string,
  log: FlueLogger,
): Promise<{ passed: boolean; rounds: number; remaining: Violation[] }> {
  const detect = async (round: number): Promise<Violation[]> => {
    const content = await harness.sandbox.readFile(path);
    const numbered = content
      .split('\n')
      .map((line, i) => `${i + 1}: ${line}`)
      .join('\n');

    const violations: Violation[] = [];
    for (const group of RULE_GROUPS) {
      const ruleList = group.map((r) => `${r.n}. ${r.text}`).join('\n');
      // Delegates to a narrow role that declares no phase tools — see
      // design-tutorial-structure.ts for why prompting the calling agent's own
      // conversation is unsafe here.
      const data = await delegate({
        harness,
        log,
        label: `style_checker rules ${group[0].n}-${group[group.length - 1].n}`,
        role: 'style_checker',
        result: checkResultSchema,
        prompt: [
          `Check the page below against ONLY these writing style rules:`,
          ``,
          ruleList,
          ``,
          `--- PAGE (${path}, with line numbers) ---`,
          numbered,
        ].join('\n'),
      });
      violations.push(...data.violations);
      log.info(
        `Style check round ${round}, rules ${group[0].n}-${group[group.length - 1].n}: ` +
          `${data.violations.length} violation(s)`,
      );
    }
    return violations;
  };

  for (let round = 1; ; round++) {
    const violations = await detect(round);
    if (violations.length === 0) {
      return { passed: true, rounds: round, remaining: [] };
    }
    if (round > MAX_FIX_ROUNDS) {
      log.info(`Style violations remain after ${MAX_FIX_ROUNDS} fix rounds — finishing with known issues`);
      return { passed: false, rounds: round, remaining: violations };
    }

    // Batch the round's violations by rule group and run one fixer pass per
    // group — each pass reads the page once and applies all its fixes together,
    // instead of one read/edit cycle per violation. The next loop iteration's
    // re-detection is the safety net for anything a batch skips.
    const batches = new Map<number, Violation[]>();
    for (const vln of violations) {
      const gi = ruleGroupIndex(vln.rule);
      const bucket = batches.get(gi);
      if (bucket) bucket.push(vln);
      else batches.set(gi, [vln]);
    }
    for (const [gi, groupViolations] of batches) {
      const first = RULE_GROUPS[gi][0].n;
      const last = RULE_GROUPS[gi][RULE_GROUPS[gi].length - 1].n;
      await delegate({
        harness,
        log,
        label: `style_fixer rules ${first}-${last}`,
        role: 'style_fixer',
        result: v.object({ summary: v.string() }),
        prompt: [
          `Fix ALL of these writing style violations in ${path} in a single pass —`,
          `read the file once, apply every fix below, then finish:`,
          ``,
          ...groupViolations.map((x) => `- rule ${x.rule} @ line ${x.line}: ${x.problem}`),
        ].join('\n'),
      });
      log.info(`Style fix pass rules ${first}-${last}: ${groupViolations.length} violation(s)`);
    }
  }
}
