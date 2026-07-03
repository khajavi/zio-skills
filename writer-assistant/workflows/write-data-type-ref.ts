import * as v from 'valibot';
import 'dotenv/config.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { defineWorkflow } from '@flue/runtime';
import docsWriterAgent from '../agents/docs-writer.js';
import {
  normalizeDataTypePath,
  validatePathsAndResolve,
  inferSourceDirs,
} from '../lib/scala-source-discovery.js';
import { runResearchPhase } from './phases/research.js';
import { extractReviewResult } from './phases/review.js';
import { extractStyleResult } from './phases/style.js';
import { extractBuildVerifyResult } from './phases/build-verify.js';
import { runExamplesPhase } from './phases/examples.js';
import { runDiagramPhase } from './phases/diagram.js';
import { findRecentlyModifiedMarkdownFiles } from '../lib/markdown-utils.js';
import { createRunSummaryTracker, formatSummaryReport } from './utils/run-summary.js';

export default defineWorkflow({
  agent: docsWriterAgent,
  input: v.looseObject({}),
  run: writeDataTypeRefRun as (ctx: any) => any,
});

async function writeDataTypeRefRun({
  harness,
  input,
  log,
}: {
  harness: any;
  input: any;
  log: any;
}) {
  const {
    projectRoot,
    outputPath,
    dataTypePath,
    examples: examplesPayload,
    diagram: diagramPayload,
  } = input as {
    projectRoot: string;
    outputPath: string;
    dataTypePath?: string;
    /** Optional: generate companion Scala examples after writing the article. */
    examples?: { moduleName: string; packageName?: string; parentModule?: string };
    /** Optional: generate an interactive JSX diagram and embed it in the article. */
    diagram?: { outputPath?: string; prompt?: string };
  };

  // Validate inputs
  if (!projectRoot) throw new Error('input.projectRoot is required');
  if (!outputPath) throw new Error('input.outputPath is required');

  // Validate paths and resolve relative output path
  const resolvedOutputPath = validatePathsAndResolve(projectRoot, outputPath);

  // Infer possible source directories from project root
  const sourceDirs = inferSourceDirs(projectRoot);

  // Normalize data type path input (if provided)
  const dataTypeInfo = normalizeDataTypePath(dataTypePath);

  // Extract type name from output path (e.g., docs/reference/chunk.md -> chunk)
  const outputFileName = path.basename(outputPath, '.md');
  const outputTypeNameCandidate = outputFileName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

  // Use dataTypePath type name if provided, otherwise infer from output path
  const typeName = dataTypeInfo.typeName || outputTypeNameCandidate;

  console.log(`[docs-write-data-type-ref] Starting documentation generation`);
  console.log(`  Type name: ${typeName}`);
  console.log(`  Output path (relative): ${outputPath}`);
  console.log(`  Output path (resolved): ${resolvedOutputPath}`);
  console.log(`  Project root: ${projectRoot}`);
  if (dataTypeInfo.filePath) {
    console.log(`  Data type path: ${dataTypeInfo.filePath}`);
  }
  console.log(`  Possible source dirs (discovered):`);
  sourceDirs.forEach((dir, i) => {
    console.log(`    [${i + 1}] ${dir}`);
  });

  const phasesCompleted: string[] = [];
  let mdocErrors = 0;
  let methodsCovered = 0;

  // Track token usage, cost, and per-phase timing across every session in this run
  const tracker = createRunSummaryTracker(harness, { workflowName: 'docs-write-data-type-ref' });
  harness = tracker.harness;

  try {
    // Set environment variable for agents' sandbox cwd
    process.env.FLUE_PROJECT_ROOT = projectRoot;

    // Initialize writer session (used for research delegation and all writer phases)
    const session = await harness.session('docs-write-data-type-ref');

    // Phase 1: Research (delegated to docs-researcher subagent)
    tracker.beginPhase('research');
    console.log('\n[Phase 1] Research: Understanding the data type...');
    const researchResult = await runResearchPhase(session, {
      projectRoot,
      typeName,
      resolvedOutputPath,
      sourceDirs,
      dataTypeInfo,
      focus: 'data-type-ref',
    });
    console.log('[Phase 1] ✓ Research complete');
    phasesCompleted.push('research');

    // Phase 2: Write Documentation
    tracker.beginPhase('write');
    console.log('\n[Phase 2] Writing: Generating documentation...');
    const phase2StartTime = Date.now();
    const writePrompt = `**Research Findings (from research phase):**
${researchResult}

---

**Phase 2: Write Documentation**

Based on the research findings above, now write comprehensive reference documentation for ${typeName}.

**Requirements:**
- Output file path: ${resolvedOutputPath}
- File must have proper frontmatter with id, title, description, and keywords
  - description: one sentence, ≤150 characters, describes what the type does
  - keywords: 3-7 meaningful phrases (1-3 words each), e.g. feature names, patterns, synonyms
- Follow the exact section structure provided in the docs-data-type-ref skill
- Every public method MUST be documented
- All code examples MUST use mdoc syntax
- No blank lines between consecutive code blocks
- Include explanatory paragraphs between code block groups

**Writing guidance:**
- Use the docs-data-type-ref skill for detailed conventions
- Opening definition: NO markdown heading, start immediately after frontmatter
- Structure sections precisely as documented: Opening → Motivation → Quick Showcase → Installation → Construction → Core Operations → (Optional: Subtypes/Comparison/Advanced) → (Integration: only when non-trivial cross-module wiring with runnable example)
- For each method, provide: name + description → signature → usage example
- All mdoc examples should use \`mdoc:reset\` for isolated blocks

Write the complete markdown file and save it to the specified output path.`;

    const writeResult = await session.prompt(writePrompt);
    console.log('[Phase 2] ✓ Documentation written');
    phasesCompleted.push('write');

    // Phase 2.5: Examples (optional — only when `examples` payload provided)
    tracker.beginPhase('examples');
    let examplesResult: Awaited<ReturnType<typeof runExamplesPhase>> | null = null;
    if (examplesPayload) {
      console.log('\n[Phase 2.5] Examples: Generating companion Scala examples...');
      examplesResult = await runExamplesPhase(harness, {
        projectRoot,
        moduleName: examplesPayload.moduleName,
        packageName: examplesPayload.packageName,
        parentModule: examplesPayload.parentModule,
        topic: typeName,
        docType: 'data-type-ref',
        outputDocPath: resolvedOutputPath,
        session, // reuse the writer session
      });
      console.log(
        `[Phase 2.5] ${examplesResult.success ? '✓' : '⚠'} Examples phase complete ` +
          `(${examplesResult.exampleFiles.length} files, compile: ${examplesResult.compileSuccess ? '✓' : '✗'}, run: ${examplesResult.runSuccess ? '✓' : '✗'})`
      );
      phasesCompleted.push('examples');
    }

    // Phase 2.6: Diagram (optional — only when `diagram` payload provided)
    tracker.beginPhase('diagram');
    let diagramResult: Awaited<ReturnType<typeof runDiagramPhase>> | null = null;
    if (diagramPayload) {
      console.log('\n[Phase 2.6] Diagram: Generating interactive JSX diagram...');
      const jsxRelPath =
        diagramPayload.outputPath ?? path.join(path.dirname(outputPath), `${typeName}Diagram.jsx`);
      const resolvedJsxPath = path.resolve(projectRoot, jsxRelPath);
      diagramResult = await runDiagramPhase(harness, {
        projectRoot,
        typeName,
        resolvedJsxPath,
        sourceDirs,
        dataTypeInfo,
        researchResult,
        userPrompt: diagramPayload.prompt,
        session, // reuse writer session for article patching
        articlePath: resolvedOutputPath,
      });
      console.log(
        `[Phase 2.6] ${diagramResult.success ? '✓' : '⚠'} Diagram phase complete ` +
          `(component: ${diagramResult.componentName}, article patched: ${diagramResult.articlePatched})`
      );
      phasesCompleted.push('diagram');
    }

    // Detect all changed/new markdown files since Phase 2 started
    const docsDir = path.join(projectRoot, 'docs');
    const changedFiles = findRecentlyModifiedMarkdownFiles(projectRoot, docsDir, phase2StartTime);
    console.log(`\n[Phase 2→3] Found ${changedFiles.length} changed/new markdown files:`);
    changedFiles.forEach((file) => console.log(`  - ${file}`));

    // Phase 3: Verify
    tracker.beginPhase('verify');
    console.log('\n[Phase 3] Verifying: Checking documentation and code...');
    await session.prompt(
      `**Phase 3: Verify data-type-ref**\n\nCall the \`verify_docs\` action to verify the data-type-ref you just wrote.`
    );
    console.log('[Phase 3] ✓ Verification complete');
    phasesCompleted.push('verify');

    // Phase 4: Review and Fix
    tracker.beginPhase('review');
    console.log('\n[Phase 4] Reviewing: Critique and fix loop...');
    const reviewPromptResult = await session.prompt(
      `**Phase 4: Review and fix data-type-ref**\n\nCall the \`review_docs\` action to run the critic/fix loop on the data-type-ref you just wrote.`
    );
    const reviewPromptText =
      typeof reviewPromptResult === 'string'
        ? reviewPromptResult
        : String((reviewPromptResult as any)?.text ?? '');
    const reviewResult = extractReviewResult(reviewPromptText);
    console.log(
      `[Phase 4] ${reviewResult.approved ? '✓' : '⚠'} Review complete (${reviewResult.rounds} round(s))`
    );
    if (!reviewResult.approved && reviewResult.unresolvedIssues.length > 0) {
      console.log(`  Unresolved issues (${reviewResult.unresolvedIssues.length}):`);
      reviewResult.unresolvedIssues.forEach((issue) => console.log(`    - ${issue}`));
    }
    phasesCompleted.push('review');

    // Phase 5: Style Validation
    tracker.beginPhase('style');
    console.log('\n[Phase 5] Validating: Checking prose style...');
    const stylePromptResult = await session.prompt(
      `**Phase 5: Validate data-type-ref style**\n\nCall the \`style_docs\` action to check and fix prose style violations in the data-type-ref you just wrote.`
    );
    const stylePromptText =
      typeof stylePromptResult === 'string'
        ? stylePromptResult
        : String((stylePromptResult as any)?.text ?? '');
    const styleResult = extractStyleResult(stylePromptText);
    console.log(
      `[Phase 5] ${styleResult.passed ? '✓' : '⚠'} Style validation complete (${styleResult.rounds} round(s))`
    );
    if (!styleResult.passed && styleResult.unresolvedViolations.length > 0) {
      console.log(`  Unresolved violations (${styleResult.unresolvedViolations.length}):`);
      styleResult.unresolvedViolations.forEach((violation) => console.log(`    - ${violation}`));
    }
    phasesCompleted.push('style');

    // Phase 6: Integrate
    tracker.beginPhase('integrate');
    console.log('\n[Phase 6] Integrating: Wiring into docs structure...');
    await session.prompt(
      `**Phase 6: Integrate data-type-ref**\n\nCall the \`integrate_docs\` action to wire the data-type-ref you just wrote into the docs structure.`
    );
    console.log('[Phase 6] ✓ Integration complete');
    phasesCompleted.push('integrate');

    // Phase 7: Build Verification with auto-fix loop
    tracker.beginPhase('verifyBuild');
    console.log('\n[Phase 7] Build Verification: Verifying documentation builds...');
    const buildPromptResult = await session.prompt(
      `**Phase 7: Build verification**\n\nCall the \`build_verify_docs\` action to build the documentation site and fix any build errors for the data-type-ref you just wrote.`
    );
    const buildPromptText =
      typeof buildPromptResult === 'string'
        ? buildPromptResult
        : String((buildPromptResult as any)?.text ?? '');
    const buildVerifyResult = extractBuildVerifyResult(buildPromptText);
    phasesCompleted.push('verifyBuild');

    // Build final result — base 7 phases + optional examples and diagram phases
    const expectedPhases = 7 + (examplesPayload ? 1 : 0) + (diagramPayload ? 1 : 0);
    const success = phasesCompleted.length === expectedPhases;
    console.log(`\n[docs-write-data-type-ref] ${success ? '✓ SUCCESS' : '⚠ PARTIAL'}`);
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
      typeName,
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
      diagram: diagramResult
        ? {
            success: diagramResult.success,
            componentName: diagramResult.componentName,
            jsxOutputPath: diagramResult.jsxOutputPath,
            articlePatched: diagramResult.articlePatched,
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
      },
    };
  } catch (error) {
    console.error(
      `[docs-write-data-type-ref] Error: ${error instanceof Error ? error.message : String(error)}`
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
      typeName,
      outputPath,
      resolvedOutputPath,
      projectRoot,
      status: 'failed',
      phasesCompleted,
      error: error instanceof Error ? error.message : String(error),
      success: false,
      examples: null,
      diagram: null,
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
      },
    };
  }
}
