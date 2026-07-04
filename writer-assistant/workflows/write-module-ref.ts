import * as v from 'valibot';
import 'dotenv/config.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { defineWorkflow } from '@flue/runtime';
import docsWriterAgent from '../agents/docs-writer.js';
import { validatePathsAndResolve, inferSourceDirs } from '../lib/scala-source-discovery.js';
import { findRecentlyModifiedMarkdownFiles } from '../lib/markdown-utils.js';
import { runResearchPhase } from './phases/research.js';
import { extractReviewResult } from './phases/review.js';
import { extractStyleResult } from './phases/style.js';
import { extractBuildVerifyResult } from './phases/build-verify.js';
import { runExamplesPhase, type DocType } from './phases/examples.js';
import { runDiagramPhase } from './phases/diagram.js';
import {
  createRunSummaryTracker,
  formatSummaryReport,
  type RunSummary,
} from './utils/run-summary.js';

export type { DocType };

export interface WriteModuleRefResult {
  summary: RunSummary;
  moduleName: string;
  outputPath: string;
  resolvedOutputPath: string;
  projectRoot: string;
  status: 'success' | 'partial' | 'failed';
  phasesCompleted: string[];
  success: boolean;
  error?: string;
  examples: {
    success: boolean;
    moduleName: string;
    exampleFiles: string[];
    compileSuccess: boolean;
    runSuccess: boolean;
    lintSuccess: boolean;
    documentationAdded: boolean;
  } | null;
  diagram: {
    success: boolean;
    componentName: string;
    jsxOutputPath: string;
    articlePatched: boolean;
  } | null;
  review: {
    approved: boolean;
    rounds: number;
    findingsFixed: { HIGH: number; MEDIUM: number; LOW: number };
    unresolvedIssues: string[];
  };
  style: {
    passed: boolean;
    rounds: number;
    violations: Record<string, number>;
    unresolvedViolations: string[];
  };
  buildVerify: {
    success: boolean;
    skipped: boolean;
    buildSystem: string;
    durationMs: number;
  };
}

export default defineWorkflow({
  agent: docsWriterAgent,
  input: v.looseObject({}),
  run: writeModuleRefRun as (ctx: any) => any,
});

async function writeModuleRefRun({ harness, input, log }: { harness: any; input: any; log: any }) {
  const {
    projectRoot,
    moduleName,
    outputPath,
    structure,
    examples: examplesPayload,
    diagram: diagramPayload,
  } = input as {
    projectRoot: string;
    moduleName: string;
    outputPath: string;
    structure?: 'flat' | 'hierarchical';
    examples?: { moduleName: string; packageName?: string; parentModule?: string };
    diagram?: { outputPath?: string; prompt?: string };
  };

  if (!projectRoot) throw new Error('input.projectRoot is required');
  if (!moduleName) throw new Error('input.moduleName is required');
  if (!outputPath) throw new Error('input.outputPath is required');

  // validatePathsAndResolve checks projectRoot exists + is a directory, resolves output path,
  // and creates the parent directory. For hierarchical output (directory path), we also
  // create the output directory itself.
  const resolvedOutputPath = validatePathsAndResolve(projectRoot, outputPath);
  const outputIsDir =
    outputPath.endsWith('/') || outputPath.endsWith(path.sep) || structure === 'hierarchical';
  if (outputIsDir) {
    fs.mkdirSync(resolvedOutputPath, { recursive: true });
  }

  const sourceDirs = inferSourceDirs(projectRoot);

  console.log(`[write-module-ref] Starting module reference documentation`);
  console.log(`  Module name:            ${moduleName}`);
  console.log(`  Output path (relative): ${outputPath}`);
  console.log(`  Output path (resolved): ${resolvedOutputPath}`);
  console.log(`  Structure override:     ${structure ?? '(agent decides from skill rule)'}`);
  console.log(`  Project root:           ${projectRoot}`);
  console.log(`  Possible source dirs (discovered):`);
  sourceDirs.forEach((dir, i) => {
    console.log(`    [${i + 1}] ${dir}`);
  });

  const phasesCompleted: string[] = [];

  // Track token usage, cost, and per-phase timing across every session in this run
  const tracker = createRunSummaryTracker(harness, { workflowName: 'write-module-ref' });
  harness = tracker.harness;

  try {
    process.env.FLUE_PROJECT_ROOT = projectRoot;

    // Initialize writer session (used for research delegation and all writer phases)
    const session = await harness.session('write-module-ref');

    // Phase 1: Research (delegated to docs-researcher subagent)
    tracker.beginPhase('research');
    console.log('\n[Phase 1] Research: Mapping the module...');
    const researchResult = await runResearchPhase(session, {
      projectRoot,
      typeName: moduleName,
      resolvedOutputPath,
      sourceDirs,
      focus: 'module-ref',
    });
    console.log('[Phase 1] ✓ Research complete');
    phasesCompleted.push('research');

    // Phase 2: Write Documentation
    tracker.beginPhase('write');
    console.log('\n[Phase 2] Writing: Generating module documentation...');
    const phase2StartTime = Date.now();

    const structureInstruction = structure
      ? `**Structure (user-specified):** Use **${structure}** structure.\n` +
        (structure === 'flat'
          ? `  - Single file at: ${resolvedOutputPath}\n`
          : `  - Output directory: ${resolvedOutputPath}\n` +
            `  - Create index.md + one page per core type\n`)
      : `**Structure:** Apply the default rule from the docs-module-ref skill:\n` +
        `  - ≤ 4 core types or types always used together → flat (single file at ${resolvedOutputPath})\n` +
        `  - ≥ 5 core types OR ≥ 3 types with rich self-contained APIs → hierarchical (directory: ${resolvedOutputPath})\n` +
        `  Tell me which you chose and why before writing.\n`;

    const writePrompt = `**Research Findings (from research phase):**
${researchResult}

---

**Phase 2: Write Module Reference Documentation**

Based on the research findings above, write comprehensive reference documentation for the \`${moduleName}\` module.

${structureInstruction}

**Requirements:**
- Follow the docs-module-ref skill for all section structure and conventions
- Every module-level section is required: Opening Definition, Introduction/Motivation, Installation, How They Work Together (CRITICAL — ASCII diagram + numbered workflow), Common Patterns, Integration Points
- Document every public method on every core type
- All code examples must use mdoc syntax
- No blank lines between consecutive code blocks
- The "How They Work Together" section must include an ASCII diagram of type relationships

**Writing guidance:**
- Use the docs-module-ref skill for section structure and mdoc conventions
- Opening Definition: NO markdown heading, start immediately after frontmatter
- "How They Work Together" is the centerpiece — invest in a clear ASCII diagram and numbered workflow
- For hierarchical: create index.md first, then individual type pages

Write the complete documentation file(s) and save them to the specified output path(s).`;

    await session.prompt(writePrompt);
    console.log('[Phase 2] ✓ Documentation written');
    phasesCompleted.push('write');

    // Phase 2.5: Examples (optional)
    tracker.beginPhase('examples');
    let examplesResult: Awaited<ReturnType<typeof runExamplesPhase>> | null = null;
    if (examplesPayload) {
      console.log('\n[Phase 2.5] Examples: Generating companion Scala examples...');
      examplesResult = await runExamplesPhase(harness, {
        projectRoot,
        moduleName: examplesPayload.moduleName,
        packageName: examplesPayload.packageName,
        parentModule: examplesPayload.parentModule,
        topic: moduleName,
        docType: 'module-ref',
        outputDocPath: resolvedOutputPath,
        session,
      });
      console.log(
        `[Phase 2.5] ${examplesResult.success ? '✓' : '⚠'} Examples phase complete ` +
          `(${examplesResult.exampleFiles.length} files, compile: ${examplesResult.compileSuccess ? '✓' : '✗'}, run: ${examplesResult.runSuccess ? '✓' : '✗'})`
      );
      phasesCompleted.push('examples');
    }

    // Phase 2.6: Diagram (optional)
    tracker.beginPhase('diagram');
    let diagramResult: Awaited<ReturnType<typeof runDiagramPhase>> | null = null;
    if (diagramPayload) {
      console.log('\n[Phase 2.6] Diagram: Generating interactive JSX diagram...');
      const jsxRelPath =
        diagramPayload.outputPath ??
        path.join(path.dirname(outputPath), `${moduleName}Diagram.jsx`);
      const resolvedJsxPath = path.resolve(projectRoot, jsxRelPath);
      diagramResult = await runDiagramPhase(harness, {
        projectRoot,
        typeName: moduleName,
        resolvedJsxPath,
        sourceDirs,
        researchResult,
        userPrompt: diagramPayload.prompt,
        session,
        articlePath: resolvedOutputPath,
      });
      console.log(
        `[Phase 2.6] ${diagramResult.success ? '✓' : '⚠'} Diagram phase complete ` +
          `(component: ${diagramResult.componentName}, article patched: ${diagramResult.articlePatched})`
      );
      phasesCompleted.push('diagram');
    }

    // Detect changed markdown files since Phase 2 started
    const docsDir = path.join(projectRoot, 'docs');
    const changedFiles = findRecentlyModifiedMarkdownFiles(projectRoot, docsDir, phase2StartTime);
    console.log(`\n[Phase 2→3] Found ${changedFiles.length} changed/new markdown files:`);
    changedFiles.forEach((file) => console.log(`  - ${file}`));

    // Phase 3: Verify
    tracker.beginPhase('verify');
    console.log('\n[Phase 3] Verifying: Checking documentation and code...');
    await session.prompt(
      `**Phase 3: Verify module-ref**\n\nCall the \`verify_docs\` action to verify the module-ref you just wrote.`
    );
    console.log('[Phase 3] ✓ Verification complete');
    phasesCompleted.push('verify');

    // Phase 4: Review and Fix
    tracker.beginPhase('review');
    console.log('\n[Phase 4] Reviewing: Critique and fix loop...');
    const reviewPromptResult = await session.prompt(
      `**Phase 4: Review and fix module-ref**\n\nCall the \`review_docs\` action to run the critic/fix loop on the module-ref you just wrote.`
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
      `**Phase 5: Validate module-ref style**\n\nCall the \`style_docs\` action to check and fix prose style violations in the module-ref you just wrote.`
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
      `**Phase 6: Integrate module-ref**\n\nCall the \`integrate_docs\` action to wire the module-ref you just wrote into the docs structure.`
    );
    console.log('[Phase 6] ✓ Integration complete');
    phasesCompleted.push('integrate');

    // Phase 7: Build Verification with auto-fix loop
    tracker.beginPhase('verifyBuild');
    console.log('\n[Phase 7] Build Verification: Verifying documentation builds...');
    const buildPromptResult = await session.prompt(
      `**Phase 7: Build verification**\n\nCall the \`build_verify_docs\` action to build the documentation site and fix any build errors for the module-ref you just wrote.`
    );
    const buildPromptText =
      typeof buildPromptResult === 'string'
        ? buildPromptResult
        : String((buildPromptResult as any)?.text ?? '');
    const buildVerifyResult = extractBuildVerifyResult(buildPromptText);
    phasesCompleted.push('verifyBuild');

    const expectedPhases = 7 + (examplesPayload ? 1 : 0) + (diagramPayload ? 1 : 0);
    const success = phasesCompleted.length === expectedPhases;
    console.log(`\n[write-module-ref] ${success ? '✓ SUCCESS' : '⚠ PARTIAL'}`);
    console.log(`  Phases completed: ${phasesCompleted.join(', ')}`);
    console.log(`  Output: ${resolvedOutputPath}`);

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
      moduleName,
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
    } satisfies WriteModuleRefResult;
  } catch (error) {
    console.error(
      `[write-module-ref] Error: ${error instanceof Error ? error.message : String(error)}`
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
      moduleName,
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
