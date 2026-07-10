import * as v from 'valibot';
import type { FlueHarness, FlueLogger } from '@flue/runtime';
import { allTodosCompleted, resetTodos, todoCreate, todoList, todoUpdate } from '../tools/todo-tools.ts';
// Single source of truth for the 25 rules, shared with the writing-style
// skill (its SKILL.md points here; only the SKILL.md basename itself is
// barred from markdown imports by the build).
import rulesMarkdown from '../skills/writing-style/references/rules.md' with { type: 'markdown' };

export const violationSchema = v.object({
  rule: v.pipe(v.number(), v.description('The violated rule number')),
  line: v.pipe(v.number(), v.description('Line where the violation starts (from the N: prefixes)')),
  problem: v.pipe(v.string(), v.description('What is wrong, specific enough to fix without re-reading the rule')),
});

const checkResultSchema = v.object({ violations: v.array(violationSchema) });
export type Violation = v.InferOutput<typeof violationSchema>;

// Parse "N. **rule text**" lines out of the imported rules file once at module
// init, then chunk into groups so each checker call judges a handful of rules
// with full attention instead of all 25 at once.
const RULES: { n: number; text: string }[] = rulesMarkdown
  .split('\n')
  .map((line) => /^(\d+)\. (.+)$/.exec(line))
  .filter((m): m is RegExpExecArray => m !== null)
  .map((m) => ({ n: Number(m[1]), text: m[2] }));

const GROUP_SIZE = 5;
const RULE_GROUPS: (typeof RULES)[] = [];
for (let i = 0; i < RULES.length; i += GROUP_SIZE) {
  RULE_GROUPS.push(RULES.slice(i, i + GROUP_SIZE));
}

// Detection runs once more than fixing, so the last fix pass is always verified.
// Default 1 fix pass; override per run with MAX_FIX_ROUNDS=n.
const MAX_FIX_ROUNDS = Number(process.env.MAX_FIX_ROUNDS ?? 1);

const TRANSIENT = /connection error|econnreset|etimedout|fetch failed|socket hang up/i;

/**
 * Programmatic session.task calls have no durable retry (see
 * concepts/durable-execution: "not recovered this way"), so one transient
 * provider drop would fail the whole action. Retry transient transport
 * errors a couple of times; rethrow everything else.
 */
export async function withTransientRetry<T>(log: FlueLogger, label: string, op: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await op();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt >= 3 || !TRANSIENT.test(message)) throw error;
      log.info(`${label} failed with transient error (attempt ${attempt}/3), retrying: ${message}`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 5_000));
    }
  }
}

/**
 * Detect and fix writing-style violations in a documentation page.
 *
 * Detection is a code-owned loop — every rule group is checked by a delegated
 * `style_checker` task each round, so coverage of all 25 rules never depends
 * on the model remembering a checklist. Fixing is one delegated `style_fixer`
 * task per round, harnessed through the todo tools (one task per violation,
 * worked one at a time); `allTodosCompleted()` gates its result, and the
 * re-detection round is the ground truth that the fixes landed.
 */
export async function runStyleLoop(
  harness: FlueHarness,
  path: string,
  log: FlueLogger,
): Promise<{ passed: boolean; rounds: number; remaining: Violation[] }> {
  const session = await harness.session();

  const detect = async (round: number): Promise<Violation[]> => {
    const content = await harness.fs.readFile(path);
    const numbered = content
      .split('\n')
      .map((line, i) => `${i + 1}: ${line}`)
      .join('\n');

    const violations: Violation[] = [];
    for (const group of RULE_GROUPS) {
      const ruleList = group.map((r) => `${r.n}. ${r.text}`).join('\n');
      // Delegates to a no-action subagent — see design-tutorial-structure.ts
      // for why bare harness.session() on the calling agent is unsafe here.
      const { data } = await withTransientRetry(log, `style_checker rules ${group[0].n}-${group[group.length - 1].n}`, () =>
        session.task(
          [
            `Check the page below against ONLY these writing style rules:`,
            ``,
            ruleList,
            ``,
            `--- PAGE (${path}, with line numbers) ---`,
            numbered,
          ].join('\n'),
          { agent: 'style_checker', result: checkResultSchema },
        ),
      );
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

    await withTransientRetry(log, 'style_fixer', () => {
      resetTodos(); // inside the retry so a retried fixer starts with a clean tree
      return session.task(
        [
          `Fix these writing style violations in ${path}:`,
          ``,
          ...violations.map((x) => `- rule ${x.rule} @ line ${x.line}: ${x.problem}`),
        ].join('\n'),
        {
          agent: 'style_fixer',
          tools: [todoCreate, todoUpdate, todoList],
          result: v.object({ summary: v.string() }),
        },
      );
    });
    if (!allTodosCompleted()) {
      log.info('Style fixer finished with an incomplete todo tree — re-detection will catch what was skipped');
    }
  }
}
