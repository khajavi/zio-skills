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
import { runReviewPhase } from './phases/review.js';
import { runStylePhase } from './phases/style.js';
import { runBuildVerifyPhase } from './phases/build-verify.js';
import { runIntegratePhase } from './phases/integrate.js';
import { runExamplesSubPhase } from './phases/examples.js';
import { runVerifyPhase } from './phases/verify.js';
import { findRecentlyModifiedMarkdownFiles } from '../lib/markdown-utils.js';

export default defineWorkflow({
  agent: docsWriterAgent,
  input: v.looseObject({}),
  run: writeTutorialRun as (ctx: any) => any,
});

async function writeTutorialRun({ harness, input }: { harness: any; input: any }) {
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

  try {
    // Set environment variable for agents' sandbox cwd
    process.env.FLUE_PROJECT_ROOT = projectRoot;

    const writerPhases = ['write', 'verify', 'integrate', 'review', 'style'];
    const needsSession =
      !skipPhases.includes('research') || writerPhases.some((p) => !skipPhases.includes(p));
    let session: any = needsSession ? await harness.session('docs-write-tutorial') : null;

    // Phase 1: Research (delegated to docs-researcher subagent)
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
    let phase2StartTime = Date.now();
    if (skipPhases.includes('write')) {
      console.log('\n[Phase 2] ⏭ Write skipped');
      phasesCompleted.push('write');
    } else {
      console.log('\n[Phase 2] Writing: Generating tutorial...');
      phase2StartTime = Date.now();
      const section5Override = examplesPayload
        ? `\n- **Skip section 5 (Running the Examples)**: Do NOT write this section. It will be inserted automatically after companion Scala example files are generated.`
        : '';
      const writePrompt = `**Research Findings (from research phase):**
${researchResult}

---

**Phase 2: Write Tutorial Documentation**

Write a comprehensive tutorial for learning about ${topic}.

Follow the docs-tutorial skill for section structure, writing style, mdoc conventions, and all other authoring rules.

**Workflow-specific requirements:**
- Output file path: ${resolvedOutputPath}${section5Override}

Write the complete markdown file and save it to the output path above.`;

      await session!.prompt(writePrompt);
      console.log('[Phase 2] ✓ Tutorial written');
      phasesCompleted.push('write');
    }

    // Phase 2.5: Examples (optional — only when `examples` payload provided)
    const examplesResult = await runExamplesSubPhase(harness, session, examplesPayload, {
      projectRoot, topic, resolvedOutputPath,
      docType: 'tutorial',
      skipPhases, phasesCompleted,
    });

    // Detect all changed/new markdown files since Phase 2 started
    const changedFiles = findRecentlyModifiedMarkdownFiles(projectRoot, docsDir, phase2StartTime);
    console.log(`\n[Phase 2→3] Found ${changedFiles.length} changed/new markdown files:`);
    changedFiles.forEach((file) => console.log(`  - ${file}`));

    // Phase 3: Verify
    if (skipPhases.includes('verify')) {
      console.log('\n[Phase 3] ⏭ Verify skipped');
      phasesCompleted.push('verify');
    } else {
      console.log('\n[Phase 3] Verifying: Checking documentation and code...');
      await runVerifyPhase(session!, { projectRoot, changedFiles, topic, resolvedOutputPath, docType: 'tutorial' });
      console.log('[Phase 3] ✓ Verification complete');
      phasesCompleted.push('verify');
    }

    // Phase 4: Review and Fix
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
      reviewResult = await runReviewPhase(harness, {
        outputPath: resolvedOutputPath,
        projectRoot,
        typeName: topic,
        session: session!, // reuse writer session for fixes
        sourceFiles: sourceDirs,
      });
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
        session: session!, // reuse writer session for fixes
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
    if (skipPhases.includes('integrate')) {
      console.log('\n[Phase 6] ⏭ Integrate skipped');
      phasesCompleted.push('integrate');
    } else {
      console.log('\n[Phase 6] Integrating: Wiring into docs structure...');
      await runIntegratePhase(session!, { projectRoot, outputFileName, topic, docType: 'tutorial' });
      console.log('[Phase 6] ✓ Integration complete');
      phasesCompleted.push('integrate');
    }

    // Phase 7: Build Verification with auto-fix loop
    const buildVerifyResult = await runBuildVerifyPhase(harness, session, {
      docsDir, projectRoot, skipPhases,
      sessionName: 'docs-write-tutorial',
    });
    phasesCompleted.push('verifyBuild');

    // Build final result — base 7 phases + optional examples phase
    const expectedPhases = 7 + (examplesPayload ? 1 : 0);
    const success =
      phasesCompleted.length === expectedPhases &&
      buildVerifyResult.success &&
      reviewResult.approved &&
      styleResult.passed;
    console.log(`\n[docs-write-tutorial] ${success ? '✓ SUCCESS' : '⚠ PARTIAL'}`);
    console.log(`  Phases completed: ${phasesCompleted.join(', ')}`);
    console.log(`  Output file: ${resolvedOutputPath}`);
    console.log(`  File exists: ${fs.existsSync(resolvedOutputPath)}`);

    return {
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
    return {
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
