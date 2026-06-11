import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import type { FlueContext } from '@flue/runtime';

export interface StyleConfig {
  outputPath: string; // absolute path to the written .md file
  projectRoot: string;
  typeName: string;
  session: any; // AgentSession reused from writer for fixes
}

export interface StyleResult {
  passed: boolean;
  rounds: number;
  violations: { [rule: string]: number };
  unresolvedViolations: string[];
}

const MAX_ROUNDS = 3;
const CHECK_STYLE_SCRIPT = path.join(process.env.FLUE_PROJECT_ROOT || process.cwd(), 'plugins/documentation/skills/docs-writing-style/check-docs-style.sh');

/**
 * Run the style validation phase: check style → fix → re-validate until passed or max rounds
 * Uses mechanical check-docs-style.sh validation and the writer session for fixes
 * Iterates until style violations reach zero or MAX_ROUNDS is reached
 */
export async function runStylePhase(init: FlueContext['init'], config: StyleConfig): Promise<StyleResult> {
  const { outputPath, projectRoot, typeName, session } = config;

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

    // Run mechanical style check
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

    // Parse violations from check output
    const violations = parseViolations(checkOutput);
    const totalViolations = Object.values(violations).reduce((sum, count) => sum + count, 0);

    console.log(`  Found ${totalViolations} violations:`);
    Object.entries(violations).forEach(([rule, count]) => {
      if (count > 0) {
        console.log(`    - Rule ${rule}: ${count} violation(s)`);
      }
    });

    result.violations = violations;

    // Phase A: Check if passed
    if (checkPassed && totalViolations === 0) {
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
      const unresolved = Object.entries(violations)
        .filter(([_, count]) => count > 0)
        .map(([rule, count]) => `Rule ${rule}: ${count} violation(s)`);
      return {
        passed: false,
        rounds: round,
        violations: result.violations,
        unresolvedViolations: unresolved,
      };
    }

    // Phase B: Spawn fixer for violations
    console.log(`  Spawning fixer for ${totalViolations} violations...`);

    const violationsList = Object.entries(violations)
      .filter(([_, count]) => count > 0)
      .map(
        ([rule, count]) => {
          const ruleDescriptions: { [key: string]: string } = {
            '2': 'Present tense only (no past tense)',
            '3': 'No filler phrases (remove "as we can see", "it\'s worth noting")',
            '4': 'Bullet capitalization (full sentences start with capital)',
            '7': 'Link format (use full filename with .md extension)',
            '8': 'Always qualify method names (e.g., Chunk#map, not just map)',
            '10': 'No duplicate heading (frontmatter title shouldn\'t be repeated as #)',
            '11': 'Heading hierarchy (use ##, ###, ####)',
            '12': 'No bare subheaders (intro sentence between ## and ###)',
            '13': 'No lone subheaders (single subsection should be collapsed)',
            '15': 'Code block intro prose (sentence ending with : before code)',
            '16': 'Always include imports in code blocks',
            '18': 'Prefer val over var (use immutable patterns)',
            '22': 'Table column alignment (pad with spaces)',
            '23': 'Scala 2.13 syntax default (use import x._ not import x.*)',
            '25': 'Version placeholder (@VERSION@ not hardcoded)',
          };

          return `- Rule ${rule}: ${count} violation(s) — ${ruleDescriptions[rule] || 'Style violation'}`;
        }
      )
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

  // Match lines like "Rule 8: ... (2 violations)" or similar
  // Different formats depending on the check-docs-style.sh output
  const ruleMatches = checkOutput.match(/Rule\s+(\d+)[:\s]+[^\n]*?(?:(\d+)\s+violation)/gi) || [];

  ruleMatches.forEach((match: string) => {
    const ruleNum = match.match(/\d+/)?.[0];
    const countMatch = match.match(/(\d+)\s+violation/i);
    const count = countMatch ? parseInt(countMatch[1], 10) : 1;

    if (ruleNum) {
      violations[ruleNum] = (violations[ruleNum] || 0) + count;
    }
  });

  // If no structured violations found, try to extract rule numbers mentioned
  if (Object.keys(violations).length === 0) {
    const ruleNums = checkOutput.match(/Rule\s+(\d+)/g) || [];
    ruleNums.forEach((match: string) => {
      const ruleNum = match.replace('Rule ', '');
      violations[ruleNum] = (violations[ruleNum] || 0) + 1;
    });
  }

  return violations;
}
