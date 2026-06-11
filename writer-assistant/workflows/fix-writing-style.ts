import 'dotenv/config.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { FlueContext } from '@flue/runtime';
import docsWriterAgent from '../agents/docs-writer.js';
import { runStylePhase } from './phases/style.js';

export async function run({ init, payload }: FlueContext) {
  const { filePath, typeName: typeNameInput } = payload as {
    filePath: string;
    typeName?: string;
  };

  // Validate inputs
  if (!filePath) throw new Error('payload.filePath is required');
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const typeName = typeNameInput || path.basename(filePath, '.md');

  console.log(`[fix-writing-style] Validating prose style for: ${filePath}`);
  console.log(`  Type name: ${typeName}`);

  const phasesCompleted: string[] = [];

  try {
    // Initialize writer session — reused by runStylePhase fixer prompts
    const harness = await init(docsWriterAgent, { name: 'fix-writing-style' });
    const session = await harness.session();

    // Run style validation and fixing
    console.log('\n[Phase 1] Style Validation: Checking and fixing prose style...');
    const styleResult = await runStylePhase(init, {
      outputPath: filePath,
      projectRoot: path.dirname(filePath),
      typeName,
      session,
      init, // pass init so style phase can spawn LLM checker agent
    });

    console.log(`[Phase 1] ${styleResult.passed ? '✓' : '⚠'} Style validation complete (${styleResult.rounds} round(s))`);
    if (!styleResult.passed && styleResult.unresolvedViolations.length > 0) {
      console.log(`  Unresolved violations (${styleResult.unresolvedViolations.length}):`);
      styleResult.unresolvedViolations.forEach(violation => console.log(`    - ${violation}`));
    }
    phasesCompleted.push('style');

    const success = styleResult.passed;
    console.log(`\n[fix-writing-style] ${success ? '✓ SUCCESS' : '⚠ PARTIAL'}`);
    console.log(`  Phases completed: ${phasesCompleted.join(', ')}`);
    console.log(`  File: ${filePath}`);

    return {
      filePath,
      typeName,
      success,
      phasesCompleted,
      style: {
        passed: styleResult.passed,
        rounds: styleResult.rounds,
        violations: styleResult.violations,
        unresolvedViolations: styleResult.unresolvedViolations,
      },
    };
  } catch (error) {
    console.error(`[fix-writing-style] Error: ${error instanceof Error ? error.message : String(error)}`);
    return {
      filePath,
      typeName,
      success: false,
      phasesCompleted,
      error: error instanceof Error ? error.message : String(error),
      style: {
        passed: false,
        rounds: 0,
        violations: {},
        unresolvedViolations: [],
      },
    };
  }
}
