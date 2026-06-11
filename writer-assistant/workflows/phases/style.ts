import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { FlueContext } from '@flue/runtime';
import docsStyleCheckerAgent from '../../agents/docs-style-checker.js';

export interface StyleConfig {
  outputPath: string; // absolute path to the written .md file
  projectRoot: string;
  typeName: string;
  session: any; // AgentSession reused from writer for fixes
  init?: FlueContext['init']; // optional: for spawning LLM style checker agent
}

export interface StyleResult {
  passed: boolean;
  rounds: number;
  violations: { [rule: string]: number };
  unresolvedViolations: string[];
}

const MAX_ROUNDS = 3;

// Resolve check-docs-style.sh relative to this compiled file location
// Compiled path: dist/workflows/phases/style.js
// Navigate up: dist/ → writer-assistant/ → repo root → plugins/...
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CHECK_STYLE_SCRIPT = path.resolve(
  __dirname,
  '../../../../plugins/documentation/skills/docs-writing-style/check-docs-style.sh'
);

/**
 * Run the style validation phase: mechanical check + LLM review → fix → re-validate until passed or max rounds
 * Uses both check-docs-style.sh (mechanical rules) and a fresh docs-style-checker agent (judgment rules)
 * Iterates until style violations reach zero or MAX_ROUNDS is reached
 */
export async function runStylePhase(init: FlueContext['init'], config: StyleConfig): Promise<StyleResult> {
  const { outputPath, projectRoot, typeName, session, init: initForAgent } = config;

  const result: StyleResult = {
    passed: false,
    rounds: 0,
    violations: {},
    unresolvedViolations: [],
  };

  if (!fs.existsSync(outputPath)) {
    return {
      ...result,
      passed: false,
      unresolvedViolations: [`Documentation file not found: ${outputPath}`],
    };
  }

  // Check if check-docs-style.sh exists
  if (!fs.existsSync(CHECK_STYLE_SCRIPT)) {
    console.log(`  ⚠ Style checker not found at ${CHECK_STYLE_SCRIPT}, skipping style validation`);
    return {
      ...result,
      passed: true, // Gracefully skip if script doesn't exist
      rounds: 0,
    };
  }

  const unresolvable = new Set<string>();

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    result.rounds = round;
    console.log(`\n[Phase 6] Round ${round}/${MAX_ROUNDS}: Checking documentation style...`);

    // Phase A: Mechanical check via check-docs-style.sh
    let checkOutput = '';
    let checkPassed = false;

    try {
      checkOutput = execSync(`bash "${CHECK_STYLE_SCRIPT}" "${outputPath}"`, {
        cwd: projectRoot,
        encoding: 'utf-8',
      });
      checkPassed = true;
    } catch (error: any) {
      checkOutput = error.stdout || String(error);
      checkPassed = false;
    }

    const mechanicalViolations = parseViolations(checkOutput);
    const mechanicalCount = Object.values(mechanicalViolations).reduce((sum, count) => sum + count, 0);
    console.log(`  [Mechanical] Found ${mechanicalCount} violation(s)`);
    Object.entries(mechanicalViolations).forEach(([rule, count]) => {
      if (count > 0) console.log(`    - Rule ${rule}: ${count}`);
    });

    // Phase B: LLM-based judgment check (if init is available)
    let llmViolations: { [rule: string]: number } = {};
    let llmCount = 0;

    if (initForAgent) {
      try {
        const checkerHarness = await initForAgent(docsStyleCheckerAgent, { name: `docs-style-checker-round-${round}` });
        const checkerSession = await checkerHarness.session();

        const checkerPrompt = `Review the documentation file for prose style rule violations:

File: ${outputPath}

Use the docs-writing-style skill to understand all 25 rules. Focus on these judgment-based rules that require language understanding:
- Rule 1: Person pronouns ("we" vs "you")
- Rule 5: No manual line breaks in prose
- Rule 8: Always qualify method names (e.g., Chunk#map, not map)
- Rule 12: No bare subheaders (need intro between ## and ###)
- Rule 14: When to use #### for topic organization
- Rule 17: One concept per code block
- Rule 19: Show method signatures within containing type
- Rule 20: Contextualized descriptions for code blocks

Read the file and report violations in this format:
[Rule N] <file>:<line>: <description>

Then output:
### Verdict
**APPROVED** or **ITERATE**`;

        const checkerResult = await checkerSession.prompt(checkerPrompt);
        const checkerText = checkerResult.text || String(checkerResult);

        // Parse LLM violations (same format as mechanical: [Rule N])
        llmViolations = parseViolations(checkerText);
        llmCount = Object.values(llmViolations).reduce((sum, count) => sum + count, 0);
        console.log(`  [LLM Review] Found ${llmCount} violation(s)`);
        Object.entries(llmViolations).forEach(([rule, count]) => {
          if (count > 0) console.log(`    - Rule ${rule}: ${count}`);
        });
      } catch (error) {
        console.log(`  [LLM Review] Skipped (${error instanceof Error ? error.message : 'error'})`);
      }
    }

    // Combine violations from both layers
    const allViolations: { [rule: string]: number } = { ...mechanicalViolations };
    Object.entries(llmViolations).forEach(([rule, count]) => {
      allViolations[rule] = (allViolations[rule] || 0) + count;
    });

    const totalViolations = Object.values(allViolations).reduce((sum, count) => sum + count, 0);
    result.violations = allViolations;

    // Check if passed (both layers clean)
    if (checkPassed && mechanicalCount === 0 && llmCount === 0) {
      console.log(`  ✓ Documentation style validated`);
      return {
        passed: true,
        rounds: round,
        violations: result.violations,
        unresolvedViolations: [],
      };
    }

    if (round === MAX_ROUNDS) {
      console.log(`  ⚠ Max rounds reached (${MAX_ROUNDS}). Returning unresolved violations.`);
      const unresolved = Object.entries(allViolations)
        .filter(([_, count]) => count > 0)
        .map(([rule, count]) => `Rule ${rule}: ${count} violation(s)`);
      return {
        passed: false,
        rounds: round,
        violations: result.violations,
        unresolvedViolations: unresolved,
      };
    }

    // Phase C: Spawn fixer for combined violations
    console.log(`  Spawning fixer for ${totalViolations} combined violations...`);

    const ruleDescriptions: { [key: string]: string } = {
      '1': 'Person pronouns ("we" vs "you" usage)',
      '2': 'Present tense only (no past tense)',
      '3': 'No filler phrases (remove "as we can see", "it\'s worth noting")',
      '4': 'Bullet capitalization (full sentences start with capital)',
      '5': 'No manual line breaks in prose',
      '7': 'Link format (use full filename with .md extension)',
      '8': 'Always qualify method names (e.g., Chunk#map, not just map)',
      '10': 'No duplicate heading (frontmatter title shouldn\'t be repeated as #)',
      '11': 'Heading hierarchy (use ##, ###, ####)',
      '12': 'No bare subheaders (intro sentence between ## and ###)',
      '13': 'No lone subheaders (single subsection should be collapsed)',
      '14': 'When to use #### (for organizing multiple topics under ###)',
      '15': 'Code block intro prose (sentence ending with : before code)',
      '16': 'Always include imports in code blocks',
      '17': 'One concept per code block',
      '18': 'Prefer val over var (use immutable patterns)',
      '19': 'Method signatures within containing type',
      '20': 'Contextualized descriptions for code blocks',
      '22': 'Table column alignment (pad with spaces)',
      '23': 'Scala 2.13 syntax default (use import x._ not import x.*)',
      '25': 'Version placeholder (@VERSION@ not hardcoded)',
    };

    const violationsList = Object.entries(allViolations)
      .filter(([_, count]) => count > 0)
      .map(([rule, count]) => `- Rule ${rule}: ${count} violation(s) — ${ruleDescriptions[rule] || 'Style violation'}`)
      .join('\n');

    const previousFeedbackSection = unresolvable.size > 0
      ? `\n**Violations that persisted in previous rounds** (be extra careful with these):\n${Array.from(unresolvable).map(u => `- ${u}`).join('\n')}\n`
      : '';

    const fixerPrompt = `Fix the following prose style violations in ${outputPath}:

${violationsList}
${previousFeedbackSection}
**Fixing instructions:**

1. **Read the document** — Understand the overall structure and content
2. **Apply fixes carefully** — Make targeted, minimal changes for each violation type
3. **Verify no regressions** — After fixing, ensure:
   - Adjacent paragraphs still make sense
   - Code block introductions are still clear
   - All links are still valid
   - Heading hierarchy is maintained
4. **Report your fixes:**
   - List each violation fixed: "✓ Fixed Rule XX: [brief description]"
   - List violations you couldn't fix: "Could not fix Rule XX: [reason]"

Focus on quality over quantity. Better to skip a fix than introduce new problems.`;

    const fixerResult = await session.prompt(fixerPrompt);
    const fixerText = fixerResult.text || String(fixerResult);

    // Parse fixer report
    const fixedMatches = fixerText.match(/✓\s*Fixed\s+Rule\s+(\d+):/gi) || [];
    const couldNotFixMatches = fixerText.match(/Could not fix\s+Rule\s+(\d+):/gi) || [];

    console.log(`    Fixed: ${fixedMatches.length} rule types, Could not fix: ${couldNotFixMatches.length} rule types`);

    // Track unresolvable violations for next round
    couldNotFixMatches.forEach((match: string) => {
      const ruleNum = match.match(/\d+/)?.[0] || 'unknown';
      const key = `Rule ${ruleNum}`;
      if (!unresolvable.has(key)) {
        unresolvable.add(key);
      }
    });

    if (unresolvable.size > 0) {
      console.log(`  Unresolvable violations tracked: ${unresolvable.size}`);
    }
  }

  return result;
}

interface ViolationCounts {
  [rule: string]: number;
}

function parseViolations(checkOutput: string): ViolationCounts {
  const violations: ViolationCounts = {};

  // Parse violations from check-docs-style.sh output format:
  // docs/reference/chunk.md:42: [Rule 2] past tense detected
  // docs/reference/chunk.md:71: [Rule 8] unqualified method `map`
  // One [Rule N] per violation line
  const linePattern = /\[Rule (\d+)\]/g;
  let match: RegExpExecArray | null;

  while ((match = linePattern.exec(checkOutput)) !== null) {
    const rule = match[1];
    violations[rule] = (violations[rule] || 0) + 1;
  }

  return violations;
}
