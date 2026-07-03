import * as v from 'valibot';
import 'dotenv/config.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { defineWorkflow } from '@flue/runtime';
import docsWriterAgent from '../agents/docs-writer.js';
import {
  toKebabCase,
  validatePathsAndResolve,
  inferSourceDirs,
} from '../lib/scala-source-discovery.js';
import { runResearchPhase } from './phases/research.js';
import { extractReviewResult } from './phases/review.js';
import { runStylePhase } from './phases/style.js';
import { runBuildVerifyPhase } from './phases/build-verify.js';
import { runIntegratePhase } from './phases/integrate.js';
import { findRecentlyModifiedMarkdownFiles } from '../lib/markdown-utils.js';
import { createRunSummaryTracker, formatSummaryReport } from './utils/run-summary.js';

export default defineWorkflow({
  agent: docsWriterAgent,
  input: v.looseObject({}),
  run: writeTutorialRun as (ctx: any) => any,
});

async function writeTutorialRun({ harness, input, log }: { harness: any; input: any; log: any }) {
  const {
    projectRoot,
    outputPath,
    topic,
    examples: examplesPayload,
    skipPhases = [],
  } = input as {
    projectRoot: string;
    outputPath: string;
    topic: string;
    /** Optional: generate companion Scala examples after writing the tutorial. */
    examples?: { moduleName: string; packageName?: string; parentModule?: string };
    /**
     * Phase names to skip. Skipped phases are counted as completed without running.
     * Valid values: "research" | "write" | "examples" | "verify" | "integrate" | "review" | "style" | "verifyBuild"
     * Example: ["research","write","verify","integrate","review","style"] to run only the build phase.
     */
    skipPhases?: string[];
  };

  // Validate inputs
  if (!projectRoot) throw new Error('input.projectRoot is required');
  if (!outputPath) throw new Error('input.outputPath is required');
  if (!topic) throw new Error('input.topic is required');

  // Validate paths and resolve relative output path
  const resolvedOutputPath = validatePathsAndResolve(projectRoot, outputPath);

  // Infer possible source directories from project root
  const sourceDirs = inferSourceDirs(projectRoot);

  // Extract tutorial name from output path (e.g., docs/guides/getting-started.md -> getting-started)
  const outputFileName = path.basename(outputPath, '.md');

  console.log(`[docs-write-tutorial] Starting tutorial documentation generation`);
  console.log(`  Topic: ${topic}`);
  console.log(`  Output path (relative): ${outputPath}`);
  console.log(`  Output path (resolved): ${resolvedOutputPath}`);
  console.log(`  Project root: ${projectRoot}`);
  console.log(`  Possible source dirs (discovered):`);
  sourceDirs.forEach((dir, i) => {
    console.log(`    [${i + 1}] ${dir}`);
  });

  const docsDir = path.join(projectRoot, 'docs');
  const phasesCompleted: string[] = [];

  // Track token usage, cost, and per-phase timing across every session in this run
  const tracker = createRunSummaryTracker(harness, { workflowName: 'docs-write-tutorial' });
  harness = tracker.harness;

  try {
    // Set environment variable for agents' sandbox cwd
    process.env.FLUE_PROJECT_ROOT = projectRoot;

    const writerPhases = ['write', 'verify', 'integrate', 'review', 'style'];
    const needsSession =
      !skipPhases.includes('research') || writerPhases.some((p) => !skipPhases.includes(p));
    let session: any = needsSession ? await harness.session('docs-write-tutorial') : null;

    // Phase 1: Research (delegated to docs-researcher subagent)
    tracker.beginPhase('research');
    let researchResult = '';
    if (skipPhases.includes('research')) {
      console.log('\n[Phase 1] ⏭ Research skipped');
      phasesCompleted.push('research');
    } else {
      console.log('\n[Phase 1] Research: Understanding the topic...');
      researchResult = await runResearchPhase(session, {
        projectRoot,
        typeName: topic,
        resolvedOutputPath,
        sourceDirs,
        focus: 'tutorial',
      });
      console.log('[Phase 1] ✓ Research complete');
      phasesCompleted.push('research');
    }

    // Phase 2: Write Documentation
    tracker.beginPhase('write');
    let phase2StartTime = Date.now();
    if (skipPhases.includes('write')) {
      console.log('\n[Phase 2] ⏭ Write skipped');
      phasesCompleted.push('write');
    } else {
      console.log('\n[Phase 2] Writing: Generating tutorial...');
      phase2StartTime = Date.now();
      const examplesActive = examplesPayload && !skipPhases.includes('examples');
      const completeExampleOverride = examplesActive
        ? (() => {
            const packageName =
              examplesPayload.packageName ?? examplesPayload.moduleName.replace(/-/g, '');
            const packageDir = path.join(
              projectRoot,
              examplesPayload.parentModule ?? '',
              examplesPayload.moduleName,
              'src',
              'main',
              'scala',
              ...packageName.split('.')
            );
            const embedPath = `${examplesPayload.moduleName}/src/main/scala/${packageName}/CompleteExample.scala`;
            return `\n- **Section 4 (Putting It Together)**: Do NOT paste the complete example as an inline code block. Instead: (1) run \`mkdir -p ${packageDir}\`, (2) write the complete, self-contained example code directly to ${path.join(packageDir, 'CompleteExample.scala')} (package \`${packageName}\`, wrapped in \`@main\`/\`object extends App\` per the naming convention used for companion examples), (3) embed it in the section with:
  \`\`\`scala mdoc:embed:${embedPath}:show-line-numbers
  \`\`\`
  Do this before calling \`write_examples\` below — that action will detect the file already exists and compile/run it alongside the other generated examples without overwriting it.`;
          })()
        : '';
      const writePrompt = `**Research Findings (from research phase):**
${researchResult}

---

**Phase 2: Write Tutorial Documentation**

Write a comprehensive tutorial for learning about ${topic}.

Follow the
  - "docs-tutorial" skill for tutorial structure,
  - "docs-writing-style" skill for prose style,
  - "docs-mdoc-conventions" skill for markdown conventions

**Workflow-specific requirements:**
- Output file path: ${resolvedOutputPath}
- Examples requested: ${examplesPayload ? JSON.stringify(examplesPayload) : 'none'}
- Skipped phases: ${JSON.stringify(skipPhases)}
- **Section 5 (Running the Examples)**: If examples were requested above and "examples" is not in the skipped phases, do NOT write this section by hand — after saving the markdown file, call the \`write_examples\` action to generate, compile, run, format, and embed the companion Scala examples; it inserts section 5 itself. Otherwise, omit section 5 entirely.${completeExampleOverride}

Write the complete markdown file and save it to the output path above.`;

      await session!.prompt(writePrompt);
      console.log('[Phase 2] ✓ Tutorial written');
      phasesCompleted.push('write');
    }

    // The write_examples action (called by the model during Phase 2, if requested) runs and
    // embeds its own results directly into the document — no structured result to capture here.
    const examplesResult: any = null;

    // Detect all changed/new markdown files since Phase 2 started
    const changedFiles = findRecentlyModifiedMarkdownFiles(projectRoot, docsDir, phase2StartTime);
    console.log(`\n[Phase 2→3] Found ${changedFiles.length} changed/new markdown files:`);
    changedFiles.forEach((file) => console.log(`  - ${file}`));

    // Phase 3: Verify
    tracker.beginPhase('verify');
    if (skipPhases.includes('verify')) {
      console.log('\n[Phase 3] ⏭ Verify skipped');
      phasesCompleted.push('verify');
    } else {
      console.log('\n[Phase 3] Verifying: Checking documentation and code...');
      await session!.prompt(
        `**Phase 3: Verify tutorial**\n\nCall the \`verify_docs\` action to verify the tutorial you just wrote.`
      );
      console.log('[Phase 3] ✓ Verification complete');
      phasesCompleted.push('verify');
    }

    // Phase 4: Review and Fix
    tracker.beginPhase('review');
    let reviewResult = {
      approved: true,
      rounds: 0,
      findingsFixed: { HIGH: 0, MEDIUM: 0, LOW: 0 } as Record<string, number>,
      unresolvedIssues: [] as string[],
    };
    if (skipPhases.includes('review')) {
      console.log('\n[Phase 4] ⏭ Review skipped');
      phasesCompleted.push('review');
    } else {
      console.log('\n[Phase 4] Reviewing: Critique and fix loop...');
      const reviewPromptResult = await session!.prompt(
        `**Phase 4: Review and fix tutorial**\n\nCall the \`review_docs\` action to run the critic/fix loop on the tutorial you just wrote.`
      );
      const reviewPromptText =
        typeof reviewPromptResult === 'string'
          ? reviewPromptResult
          : String((reviewPromptResult as any)?.text ?? '');
      reviewResult = extractReviewResult(reviewPromptText);
      console.log(
        `[Phase 4] ${reviewResult.approved ? '✓' : '⚠'} Review complete (${reviewResult.rounds} round(s))`
      );
      if (!reviewResult.approved && reviewResult.unresolvedIssues.length > 0) {
        console.log(`  Unresolved issues (${reviewResult.unresolvedIssues.length}):`);
        reviewResult.unresolvedIssues.forEach((issue) => console.log(`    - ${issue}`));
      }
      phasesCompleted.push('review');
    }

    // Phase 5: Style Validation
    tracker.beginPhase('style');
    let styleResult = {
      passed: true,
      rounds: 0,
      violations: {} as Record<string, number>,
      unresolvedViolations: [] as string[],
    };
    if (skipPhases.includes('style')) {
      console.log('\n[Phase 5] ⏭ Style skipped');
      phasesCompleted.push('style');
    } else {
      console.log('\n[Phase 5] Validating: Checking prose style...');
      styleResult = await runStylePhase(harness, {
        outputPath: resolvedOutputPath,
        projectRoot,
        typeName: topic,
      });
      console.log(
        `[Phase 5] ${styleResult.passed ? '✓' : '⚠'} Style validation complete (${styleResult.rounds} round(s))`
      );
      if (!styleResult.passed && styleResult.unresolvedViolations.length > 0) {
        console.log(`  Unresolved violations (${styleResult.unresolvedViolations.length}):`);
        styleResult.unresolvedViolations.forEach((violation) => console.log(`    - ${violation}`));
      }
      phasesCompleted.push('style');
    }

    // Phase 6: Integrate
    tracker.beginPhase('integrate');
    if (skipPhases.includes('integrate')) {
      console.log('\n[Phase 6] ⏭ Integrate skipped');
      phasesCompleted.push('integrate');
    } else {
      console.log('\n[Phase 6] Integrating: Wiring into docs structure...');
      await runIntegratePhase(session!, {
        projectRoot,
        outputFileName,
        topic,
        docType: 'tutorial',
      });
      console.log('[Phase 6] ✓ Integration complete');
      phasesCompleted.push('integrate');
    }

    // Phase 7: Build Verification with auto-fix loop
    tracker.beginPhase('verifyBuild');
    const buildVerifyResult = await runBuildVerifyPhase(harness, session, {
      docsDir,
      projectRoot,
      skipPhases,
      sessionName: 'docs-write-tutorial',
    });
    phasesCompleted.push('verifyBuild');

    // Build final result — 7 phases (examples generation is now inline within "write")
    const expectedPhases = 7;
    const success =
      phasesCompleted.length === expectedPhases &&
      buildVerifyResult.success &&
      reviewResult.approved &&
      styleResult.passed;
    console.log(`\n[docs-write-tutorial] ${success ? '✓ SUCCESS' : '⚠ PARTIAL'}`);
    console.log(`  Phases completed: ${phasesCompleted.join(', ')}`);
    console.log(`  Output file: ${resolvedOutputPath}`);
    console.log(`  File exists: ${fs.existsSync(resolvedOutputPath)}`);

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

    return {
      summary,
      topic,
      outputPath,
      resolvedOutputPath,
      projectRoot,
      status: success ? 'success' : 'partial',
      phasesCompleted,
      success,
      examples: examplesResult
        ? {
            success: examplesResult.success,
            moduleName: examplesResult.moduleName,
            exampleFiles: examplesResult.exampleFiles,
            compileSuccess: examplesResult.compileSuccess,
            runSuccess: examplesResult.runSuccess,
            lintSuccess: examplesResult.lintSuccess,
            documentationAdded: examplesResult.documentationAdded,
          }
        : null,
      review: {
        approved: reviewResult.approved,
        rounds: reviewResult.rounds,
        findingsFixed: reviewResult.findingsFixed,
        unresolvedIssues: reviewResult.unresolvedIssues,
      },
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
        rounds: buildVerifyResult.rounds,
      },
    };
  } catch (error) {
    console.error(
      `[docs-write-tutorial] Error: ${error instanceof Error ? error.message : String(error)}`
    );

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

    return {
      summary,
      topic,
      outputPath,
      resolvedOutputPath,
      projectRoot,
      status: 'failed',
      phasesCompleted,
      error: error instanceof Error ? error.message : String(error),
      success: false,
      examples: null,
      review: {
        approved: false,
        rounds: 0,
        findingsFixed: { HIGH: 0, MEDIUM: 0, LOW: 0 },
        unresolvedIssues: [],
      },
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
        rounds: 0,
      },
    };
  }
}
