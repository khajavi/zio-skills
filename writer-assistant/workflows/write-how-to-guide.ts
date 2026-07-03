import * as v from 'valibot';
import 'dotenv/config.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { defineWorkflow } from '@flue/runtime';
import docsWriterAgent from '../agents/docs-writer.js';
import { validatePathsAndResolve, inferSourceDirs } from '../lib/scala-source-discovery.js';
import { runResearchPhase } from './phases/research.js';
import { runReviewPhase } from './phases/review.js';
import { runStylePhase } from './phases/style.js';
import { runBuildVerifyPhase } from './phases/build-verify.js';
import { runIntegratePhase } from './phases/integrate.js';
import { runExamplesSubPhase } from './phases/examples.js';
import { runVerifyPhase } from './phases/verify.js';
import { findRecentlyModifiedMarkdownFiles } from '../lib/markdown-utils.js';
import { createRunSummaryTracker, formatSummaryReport } from './utils/run-summary.js';

export default defineWorkflow({
  agent: docsWriterAgent,
  input: v.looseObject({}),
  run: writeHowToGuideRun as (ctx: any) => any,
});

async function writeHowToGuideRun({ harness, input, log }: { harness: any; input: any; log: any }) {
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
    /** Optional: generate companion Scala examples after writing the guide. */
    examples?: { moduleName: string; packageName?: string; parentModule?: string };
    /**
     * Phase names to skip. Skipped phases are counted as completed without running.
     * Valid values: "research" | "write" | "examples" | "verify" | "integrate" | "review" | "style" | "verifyBuild"
     */
    skipPhases?: string[];
  };

  if (!projectRoot) throw new Error('input.projectRoot is required');
  if (!outputPath) throw new Error('input.outputPath is required');
  if (!topic) throw new Error('input.topic is required');

  const resolvedOutputPath = validatePathsAndResolve(projectRoot, outputPath);
  const sourceDirs = inferSourceDirs(projectRoot);
  const outputFileName = path.basename(outputPath, '.md');

  console.log(`[docs-write-how-to-guide] Starting how-to guide generation`);
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
  const tracker = createRunSummaryTracker(harness, { workflowName: 'docs-write-how-to-guide' });
  harness = tracker.harness;

  try {
    process.env.FLUE_PROJECT_ROOT = projectRoot;

    const writerPhases = ['write', 'verify', 'integrate', 'review', 'style'];
    const needsSession =
      !skipPhases.includes('research') || writerPhases.some((p) => !skipPhases.includes(p));
    let session: any = needsSession ? await harness.session('docs-write-how-to-guide') : null;

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
        focus: 'guide',
      });
      console.log('[Phase 1] ✓ Research complete');
      phasesCompleted.push('research');
    }

    // Phase 2: Write Guide
    tracker.beginPhase('write');
    let phase2StartTime = Date.now();
    if (skipPhases.includes('write')) {
      console.log('\n[Phase 2] ⏭ Write skipped');
      phasesCompleted.push('write');
    } else {
      console.log('\n[Phase 2] Writing: Generating how-to guide...');
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
            return `\n- **Section 6 (Putting It Together)**: Do NOT paste the complete example as an inline code block. Instead: (1) run \`mkdir -p ${packageDir}\`, (2) write the complete, self-contained example code directly to ${path.join(packageDir, 'CompleteExample.scala')} (package \`${packageName}\`, wrapped in \`@main\`/\`object extends App\` per the naming convention used for companion examples), (3) embed it in the section with:
  \`\`\`scala mdoc:embed:${embedPath}:show-line-numbers
  \`\`\`
  The companion-examples generation step that follows this write phase will detect the file already exists and compile/run it alongside the other generated examples without overwriting it.`;
          })()
        : '';
      const writePrompt = `**Research Findings (from research phase):**
${researchResult}

---

**Phase 2: Write How-To Guide**

Based on the research findings above, now write a comprehensive how-to guide for: ${topic}

**What makes a how-to guide different from a tutorial:**
- Goal-oriented, not pedagogical — reader wants to accomplish a specific task, not learn concepts
- Assumes basic familiarity with the library — skip conceptual preambles
- Shows practical, realistic examples close to production use
- Introduces types and APIs only as needed to achieve the goal

**Requirements:**
- Output file path: ${resolvedOutputPath}
- File must be in docs/guides/ directory
- File must have proper frontmatter with id, title, description, and keywords
  - description: one sentence, ≤150 characters, describes the concrete goal the guide achieves
  - keywords: 3-7 meaningful phrases (1-3 words each), e.g. feature names, patterns, use cases
- Follow this exact 8-section structure:

**Section structure (in order):**
1. **Introduction** — 1 paragraph: what the reader will accomplish, why it's useful, the approach in one sentence
2. **The Problem** — concrete problem statement + why it matters + "before" code showing the pain
3. **Prerequisites** — sbt dependency, base imports in \`mdoc:silent\`, assumed knowledge
4. **The Core Model** — domain types in \`mdoc:silent\`, brief explanation of choices
5. **Step-by-step sections** (3-6 sections) — one new concept each: 1-3 sentence intro → code → result/output
6. **Putting It Together** — complete working example combining all steps
7. **Running the Examples** — follow the docs-examples skill "Running the Examples" section template
8. **Going Further** (optional) — links to reference pages, variations, related guides

**Writing guidance:**
- Use the docs-how-to-guide skill for detailed conventions
- Start immediately with the goal — no warm-up, no "in this guide we will"
- Use direct imperative prose: "Define a Schema", "Create a codec", "Run the effect"
- Show intermediate results (printed output, types) after major steps
- The Problem section MUST include a short code example showing the painful/boilerplate approach
- Each step-by-step section covers exactly one concept — split if two things are happening
- "Putting It Together" should be copy-paste runnable${completeExampleOverride}

Write the complete markdown file and save it to the specified output path.`;

      await session!.prompt(writePrompt);
      console.log('[Phase 2] ✓ Guide written');
      phasesCompleted.push('write');
    }

    // Phase 2.5: Examples (optional)
    tracker.beginPhase('examples');
    const examplesResult = await runExamplesSubPhase(harness, session, examplesPayload, {
      projectRoot,
      topic,
      resolvedOutputPath,
      docType: 'how-to-guide',
      skipPhases,
      phasesCompleted,
    });

    const changedFiles = findRecentlyModifiedMarkdownFiles(projectRoot, docsDir, phase2StartTime);
    console.log(`\n[Phase 2→3] Found ${changedFiles.length} changed/new markdown files:`);
    changedFiles.forEach((file) => console.log(`  - ${file}`));

    // Phase 3: Verify
    tracker.beginPhase('verify');
    if (skipPhases.includes('verify')) {
      console.log('\n[Phase 3] ⏭ Verify skipped');
      phasesCompleted.push('verify');
    } else {
      console.log('\n[Phase 3] Verifying: Checking guide and code...');
      await runVerifyPhase(session!, {
        projectRoot,
        changedFiles,
        topic,
        resolvedOutputPath,
        docType: 'how-to-guide',
      });
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
      reviewResult = await runReviewPhase(harness, {
        outputPath: resolvedOutputPath,
        projectRoot,
        typeName: topic,
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
        docType: 'how-to-guide',
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
      sessionName: 'docs-write-how-to-guide',
    });
    phasesCompleted.push('verifyBuild');

    const expectedPhases = 7 + (examplesPayload ? 1 : 0);
    const success =
      phasesCompleted.length === expectedPhases &&
      buildVerifyResult.success &&
      reviewResult.approved &&
      styleResult.passed;

    console.log(`\n[docs-write-how-to-guide] ${success ? '✓ SUCCESS' : '⚠ PARTIAL'}`);
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
      `[docs-write-how-to-guide] Error: ${error instanceof Error ? error.message : String(error)}`
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
