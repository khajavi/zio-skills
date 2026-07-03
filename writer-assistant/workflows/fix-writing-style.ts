import * as v from 'valibot';
import 'dotenv/config.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { defineWorkflow } from '@flue/runtime';
import docsWriterAgent from '../agents/docs-writer.js';
import { extractStyleResult } from './phases/style.js';
import { verifyBuild } from './phases/verify.js';
import { createRunSummaryTracker, formatSummaryReport } from './utils/run-summary.js';

function inferDocsDir(filePath: string): string | null {
  const parts = filePath.split(path.sep);
  const docsIdx = parts.lastIndexOf('docs');
  if (docsIdx === -1) return null;
  return parts.slice(0, docsIdx + 1).join(path.sep);
}

export default defineWorkflow({
  agent: docsWriterAgent,
  input: v.looseObject({}),
  run: fixWritingStyleRun as (ctx: any) => any,
});

async function fixWritingStyleRun({ harness, input, log }: { harness: any; input: any; log: any }) {
  const { filePath, typeName: typeNameInput } = input as {
    filePath: string;
    typeName?: string;
  };

  // Validate inputs
  if (!filePath) throw new Error('input.filePath is required');
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const typeName = typeNameInput || path.basename(filePath, '.md');

  console.log(`[fix-writing-style] Validating prose style for: ${filePath}`);
  console.log(`  Type name: ${typeName}`);

  const phasesCompleted: string[] = [];

  // Track token usage, cost, and per-phase timing across every session in this run
  const tracker = createRunSummaryTracker(harness, { workflowName: 'fix-writing-style' });
  harness = tracker.harness;

  const reportSummary = () => {
    const summary = tracker.finish();
    console.log(formatSummaryReport(summary));
    log.info('Run summary', {
      wallClockMs: summary.wallClockMs,
      totalTokens: summary.totals.totalTokens,
      inputTokens: summary.totals.input,
      outputTokens: summary.totals.output,
      costUsd: summary.totals.costUsd,
      phases: summary.phases.map((p) => ({
        name: p.name,
        durationMs: p.durationMs,
        costUsd: p.costUsd,
      })),
    });
    return summary;
  };

  try {
    // Run style validation and fixing
    tracker.beginPhase('style');
    console.log('\n[Phase 1] Style Validation: Checking and fixing prose style...');
    const session = await harness.session('fix-writing-style');
    const stylePromptResult = await session.prompt(
      `**Phase 1: Validate style**\n\nCall the \`style_docs\` action to check and fix prose style violations in ${filePath}.`
    );
    const stylePromptText =
      typeof stylePromptResult === 'string'
        ? stylePromptResult
        : String((stylePromptResult as any)?.text ?? '');
    const styleResult = extractStyleResult(stylePromptText);

    console.log(
      `[Phase 1] ${styleResult.passed ? '✓' : '⚠'} Style validation complete (${styleResult.rounds} round(s))`
    );
    if (!styleResult.passed && styleResult.unresolvedViolations.length > 0) {
      console.log(`  Unresolved violations (${styleResult.unresolvedViolations.length}):`);
      styleResult.unresolvedViolations.forEach((violation) => console.log(`    - ${violation}`));
    }
    phasesCompleted.push('style');

    // Phase 2: Verify Build
    tracker.beginPhase('verifyBuild');
    console.log('\n[Phase 2] Build Verification: Verifying documentation builds...');
    let buildVerifyResult = {
      success: false,
      buildSystem: 'unknown',
      durationMs: 0,
      skipped: false,
    };
    const docsDir = inferDocsDir(filePath);
    if (docsDir) {
      try {
        const buildResult = await verifyBuild(docsDir);
        buildVerifyResult = { ...buildResult, skipped: false };
        console.log(
          `[Phase 2] ${buildResult.success ? '✓' : '⚠'} Build verification complete (${buildResult.buildSystem}, ${buildResult.durationMs}ms)`
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('No supported documentation build system detected')) {
          console.log('[Phase 2] ⚠ No documentation build system detected, skipping');
          buildVerifyResult = { success: true, buildSystem: 'none', durationMs: 0, skipped: true };
        } else {
          console.log(`[Phase 2] ⚠ Build verification failed: ${msg}`);
        }
      }
    } else {
      console.log(
        '[Phase 2] ⚠ Could not infer docs directory from file path, skipping build verification'
      );
      buildVerifyResult = { success: true, buildSystem: 'none', durationMs: 0, skipped: true };
    }
    phasesCompleted.push('verifyBuild');

    const success = styleResult.passed;
    console.log(`\n[fix-writing-style] ${success ? '✓ SUCCESS' : '⚠ PARTIAL'}`);
    console.log(`  Phases completed: ${phasesCompleted.join(', ')}`);
    console.log(`  File: ${filePath}`);

    const summary = reportSummary();

    return {
      summary,
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
      buildVerify: {
        success: buildVerifyResult.success,
        skipped: buildVerifyResult.skipped,
        buildSystem: buildVerifyResult.buildSystem,
        durationMs: buildVerifyResult.durationMs,
      },
    };
  } catch (error) {
    console.error(
      `[fix-writing-style] Error: ${error instanceof Error ? error.message : String(error)}`
    );
    const summary = reportSummary();
    return {
      summary,
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
      buildVerify: {
        success: false,
        skipped: false,
        buildSystem: 'unknown',
        durationMs: 0,
      },
    };
  }
}
