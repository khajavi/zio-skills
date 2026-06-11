import * as fs from 'node:fs';
import type { FlueContext } from '@flue/runtime';
import docsReviewerAgent from '../../agents/docs-reviewer.js';

export interface ReviewConfig {
  outputPath: string; // absolute path to the written .md file
  projectRoot: string;
  typeName: string;
  session: any; // AgentSession reused from writer for fixes
  sourceFiles?: string[];
  relatedDocs?: string[];
}

export interface ReviewResult {
  approved: boolean;
  rounds: number;
  findingsFixed: { HIGH: number; MEDIUM: number; LOW: number };
  unresolvedIssues: string[];
}

const MAX_ROUNDS = 5;

/**
 * Run the review phase: critic → fix loop until approved or max rounds
 * Uses a fresh critic agent each round, reuses the writer session for fixes
 * Iterates until HIGH + MEDIUM findings reach zero or MAX_ROUNDS is reached
 */
export async function runReviewPhase(init: FlueContext['init'], config: ReviewConfig): Promise<ReviewResult> {
  const { outputPath, projectRoot, typeName, session, sourceFiles = [], relatedDocs = [] } = config;

  const result: ReviewResult = {
    approved: false,
    rounds: 0,
    findingsFixed: { HIGH: 0, MEDIUM: 0, LOW: 0 },
    unresolvedIssues: [],
  };

  if (!fs.existsSync(outputPath)) {
    return {
      ...result,
      approved: false,
      unresolvedIssues: [`Documentation file not found: ${outputPath}`],
    };
  }

  const unresolvable = new Set<string>();

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    result.rounds = round;
    console.log(`\n[Phase 5] Round ${round}/${MAX_ROUNDS}: Spawning critic...`);

    // Phase A: Spawn fresh critic
    const harness = await init(docsReviewerAgent, { name: `docs-reviewer-round-${round}` });
    const criticSession = await harness.session();

    // Build critic prompt
    const sourceFilesList = sourceFiles.length > 0 ? sourceFiles.map(f => `  - ${f}`).join('\n') : '  (none provided)';
    const relatedDocsList = relatedDocs.length > 0 ? relatedDocs.map(f => `  - ${f}`).join('\n') : '  (none provided)';

    const criticPrompt = `Review the documentation file for ${typeName}.

**Documentation file to review:**
${outputPath}

**Source files to verify accuracy against:**
${sourceFilesList}

**Related documentation to check consistency against:**
${relatedDocsList}

**Your task:**
Read the documentation file using the Read tool. If source files are provided, read them too to verify technical accuracy.

Analyze the documentation for:
- Technical accuracy against source code
- Completeness of explanations and examples
- Consistency with related documentation
- Clarity and organization

Output format MUST include two sections:

### Findings

For each finding, use this format:
**<SEVERITY>/<dimension>** — <title>
- Location: <file>:<line-range>
- Problem: <description>
- Impact: <why this matters>
- Suggestion: <how to fix>

Use SEVERITY: HIGH, MEDIUM, LOW
Use dimension: accuracy, completeness, consistency, clarity, structure

${unresolvable.size > 0 ? `\n**Exclude these previously unresolvable issues (do not re-flag):**\n${Array.from(unresolvable).map(u => `- ${u}`).join('\n')}\n` : ''}

### Verdict

**APPROVED** or **ITERATE**`;

    let criticResult = await criticSession.prompt(criticPrompt);
    let criticText = criticResult.text || String(criticResult);

    // Validate response format
    if (!criticText.includes('### Findings') || !criticText.includes('### Verdict')) {
      console.log('  ⚠ Invalid critic response format, retrying...');
      const retryResult = await criticSession.prompt(
        'Your response was incomplete. Please re-run the analysis and ensure your output includes both "### Findings" and "### Verdict" sections.',
      );
      criticText = retryResult.text || String(retryResult);

      if (!criticText.includes('### Findings') || !criticText.includes('### Verdict')) {
        console.log('  ✗ Critic failed to produce valid format after retry');
        return {
          ...result,
          approved: false,
          unresolvedIssues: ['Critic agent failed to produce properly formatted review'],
        };
      }
    }

    // Parse findings
    const findingsSection = criticText.split('### Verdict')[0];
    const verdictSection = criticText.split('### Verdict')[1] || '';

    const findings = parseFindings(findingsSection);
    const verdict = verdictSection.toLowerCase().includes('**approved**') ? 'APPROVED' : 'ITERATE';

    console.log(`  Found: ${findings.HIGH.length} HIGH, ${findings.MEDIUM.length} MEDIUM, ${findings.LOW.length} LOW`);

    // Phase C: Parse verdict
    if (verdict === 'APPROVED') {
      console.log(`  ✓ Documentation approved`);
      return {
        approved: true,
        rounds: round,
        findingsFixed: result.findingsFixed,
        unresolvedIssues: [],
      };
    }

    // Determine actionable findings for this round
    const actionable = [...findings.HIGH, ...findings.MEDIUM];

    if (actionable.length === 0) {
      console.log(`  ✓ No actionable findings (only LOW severity)`);
      return {
        approved: true,
        rounds: round,
        findingsFixed: result.findingsFixed,
        unresolvedIssues: [],
      };
    }

    if (round === MAX_ROUNDS) {
      console.log(`  ⚠ Max rounds reached (${MAX_ROUNDS}). Returning unresolved issues.`);
      const unresolved = actionable.map(f => f.title);
      return {
        approved: false,
        rounds: round,
        findingsFixed: result.findingsFixed,
        unresolvedIssues: unresolved,
      };
    }

    // Phase B: Spawn fixer using writer session
    console.log(`  Spawning fixer for ${actionable.length} findings...`);

    const fixerPrompt = `Fix the following documentation issues in ${outputPath}:

${actionable.map((f, i) => `${i + 1}. **${f.severity}/${f.dimension}** — ${f.title}\n   Location: ${f.location}\n   Problem: ${f.problem}\n   Suggestion: ${f.suggestion}`).join('\n\n')}

For each finding:
1. Read the file
2. Apply the suggested fix
3. Re-save the file

Report which findings were fixed and which could not be fixed (if any).`;

    const fixerResult = await session.prompt(fixerPrompt);
    const fixerText = fixerResult.text || String(fixerResult);

    // Track what the fixer couldn't resolve
    const couldNotFixMatches = fixerText.match(/Could not fix:(.+?)(?=\n\n|$)/gs) || [];
    couldNotFixMatches.forEach(match => {
      const title = match.replace(/Could not fix:\s*/i, '').trim();
      unresolvable.add(title);
    });

    // Update findings fixed count
    result.findingsFixed.HIGH += findings.HIGH.length;
    result.findingsFixed.MEDIUM += findings.MEDIUM.length;
    result.findingsFixed.LOW += findings.LOW.length;
  }

  return result;
}

interface Finding {
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  dimension: string;
  title: string;
  location: string;
  problem: string;
  suggestion: string;
}

interface ParsedFindings {
  HIGH: Finding[];
  MEDIUM: Finding[];
  LOW: Finding[];
}

function parseFindings(findingsText: string): ParsedFindings {
  const result: ParsedFindings = { HIGH: [], MEDIUM: [], LOW: [] };

  // Match pattern: **SEVERITY/dimension** — title
  const findingPattern = /\*\*(HIGH|MEDIUM|LOW)\/(\w+)\*\*\s*—\s*(.+?)\n\s*-\s*Location:\s*(.+?)\n\s*-\s*Problem:\s*(.+?)\n\s*-\s*(?:Impact:.*?\n\s*)?-\s*Suggestion:\s*(.+?)(?=\n\*\*|$)/gs;

  let match;
  while ((match = findingPattern.exec(findingsText)) !== null) {
    const [, severity, dimension, title, location, problem, suggestion] = match;
    const finding: Finding = {
      severity: severity as 'HIGH' | 'MEDIUM' | 'LOW',
      dimension,
      title,
      location,
      problem,
      suggestion,
    };
    result[severity as keyof ParsedFindings].push(finding);
  }

  return result;
}
