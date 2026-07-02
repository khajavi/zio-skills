import * as v from 'valibot';
import 'dotenv/config.js';
import * as path from 'node:path';
import { defineWorkflow } from '@flue/runtime';
import docsWriterAgent from '../agents/docs-writer.js';
import {
  normalizeDataTypePath,
  validatePathsAndResolve,
  inferSourceDirs,
} from '../lib/scala-source-discovery.js';
import { runResearchPhase } from './phases/research.js';
import { runDiagramPhase } from './phases/diagram.js';
import { createRunSummaryTracker, formatSummaryReport } from './utils/run-summary.js';

export default defineWorkflow({
  agent: docsWriterAgent,
  input: v.looseObject({}),
  run: designDiagramRun as (ctx: any) => any,
});

async function designDiagramRun({ harness, input, log }: { harness: any; input: any; log: any }) {
  const {
    projectRoot,
    dataTypePath,
    outputPath,
    articlePath,
    baseUrl,
    prompt: userPrompt,
  } = input as {
    projectRoot: string;
    dataTypePath?: string;
    outputPath: string;
    articlePath?: string;
    baseUrl?: string;
    prompt?: string;
  };

  if (!projectRoot) throw new Error('input.projectRoot is required');
  if (!outputPath) throw new Error('input.outputPath is required');

  const resolvedOutputPath = path.resolve(projectRoot, outputPath);
  const resolvedArticlePath = articlePath ? path.resolve(projectRoot, articlePath) : undefined;
  const sourceDirs = inferSourceDirs(projectRoot);
  const dataTypeInfo = normalizeDataTypePath(dataTypePath);

  const outputFileName = path.basename(outputPath, '.jsx');
  const typeName = dataTypeInfo.typeName || outputFileName;

  console.log(`[design-diagram] Starting diagram generation`);
  console.log(`  Type name: ${typeName}`);
  console.log(`  Output path (resolved): ${resolvedOutputPath}`);
  console.log(`  Project root: ${projectRoot}`);
  if (dataTypeInfo.filePath) console.log(`  Source file: ${dataTypeInfo.filePath}`);
  if (resolvedArticlePath) console.log(`  Article to patch: ${resolvedArticlePath}`);

  const phasesCompleted: string[] = [];

  // Track token usage, cost, and per-phase timing across every session in this run
  const tracker = createRunSummaryTracker(harness, { workflowName: 'design-diagram' });
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
    process.env.FLUE_PROJECT_ROOT = projectRoot;

    // Initialize primary session (used for research delegation)
    const session = await harness.session('design-diagram');

    // Phase 1: Research (delegated to docs-researcher subagent)
    tracker.beginPhase('research');
    console.log('\n[Phase 1] Research: Understanding the data type...');
    const researchResult = await runResearchPhase(session, {
      projectRoot,
      typeName,
      resolvedOutputPath,
      sourceDirs,
      dataTypeInfo,
      focus: 'diagram',
    });
    console.log('[Phase 1] ✓ Research complete');
    phasesCompleted.push('research');

    // Phase 2: Design diagram
    tracker.beginPhase('diagram');
    console.log('\n[Phase 2] Design: Generating interactive JSX diagram...');

    // If an article will be patched, initialize a writer session for the patch step
    let writerSession: any = null;
    if (resolvedArticlePath) {
      writerSession = await harness.session('design-diagram-writer');
    }

    // TODO: runDiagramPhase uses diagramDesignerAgent (different agent) — needs migration.
    const diagramResult = await runDiagramPhase(harness, {
      projectRoot,
      typeName,
      resolvedJsxPath: resolvedOutputPath,
      sourceDirs,
      dataTypeInfo,
      researchResult,
      baseUrl,
      userPrompt,
      session: writerSession,
      articlePath: resolvedArticlePath,
    });

    console.log(`[Phase 2] ${diagramResult.success ? '✓' : '⚠'} Diagram design complete`);
    if (diagramResult.success) {
      console.log(`  Component: ${diagramResult.componentName}`);
      console.log(`  JSX file: ${diagramResult.jsxOutputPath}`);
    }
    if (diagramResult.articlePatched) {
      console.log(`  Article patched: ${resolvedArticlePath}`);
    }
    phasesCompleted.push('diagram');

    const success = diagramResult.success && phasesCompleted.length === 2;
    console.log(`\n[design-diagram] ${success ? '✓ SUCCESS' : '⚠ PARTIAL'}`);
    console.log(`  Phases completed: ${phasesCompleted.join(', ')}`);

    const summary = reportSummary();

    return {
      summary,
      typeName,
      outputPath,
      resolvedOutputPath,
      projectRoot,
      status: success ? 'success' : 'partial',
      phasesCompleted,
      success,
      componentName: diagramResult.componentName,
      articlePatched: diagramResult.articlePatched,
    };
  } catch (error) {
    console.error(
      `[design-diagram] Error: ${error instanceof Error ? error.message : String(error)}`
    );
    const summary = reportSummary();
    return {
      summary,
      typeName,
      outputPath,
      resolvedOutputPath,
      projectRoot,
      status: 'failed',
      phasesCompleted,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      componentName: '',
      articlePatched: false,
    };
  }
}
