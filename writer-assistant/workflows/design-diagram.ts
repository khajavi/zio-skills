import 'dotenv/config.js';
import * as path from 'node:path';
import type { FlueContext } from '@flue/runtime';
import docsWriterAgent from '../agents/docs-writer.js';
import {
  normalizeDataTypePath,
  validatePathsAndResolve,
  inferSourceDirs,
} from '../lib/scala-source-discovery.js';
import { runResearchPhase } from './phases/research.js';
import { runDiagramPhase } from './phases/diagram.js';

export async function run({ init, payload }: FlueContext) {
  const {
    projectRoot,
    dataTypePath,
    outputPath,
    articlePath,
    baseUrl,
    prompt: userPrompt,
  } = payload as {
    projectRoot: string;
    dataTypePath?: string;
    outputPath: string;
    articlePath?: string;
    baseUrl?: string;
    prompt?: string;
  };

  if (!projectRoot) throw new Error('payload.projectRoot is required');
  if (!outputPath) throw new Error('payload.outputPath is required');

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

  try {
    process.env.FLUE_PROJECT_ROOT = projectRoot;

    // Phase 1: Research
    console.log('\n[Phase 1] Research: Understanding the data type...');
    const researchResult = await runResearchPhase(init, {
      projectRoot,
      typeName,
      resolvedOutputPath,
      sourceDirs,
      dataTypeInfo,
      focus: 'explanation',
    });
    console.log('[Phase 1] ✓ Research complete');
    phasesCompleted.push('research');

    // Phase 2: Design diagram
    console.log('\n[Phase 2] Design: Generating interactive JSX diagram...');

    // If an article will be patched, initialize a writer session for the patch step
    let writerSession: any = null;
    if (resolvedArticlePath) {
      const harness = await init(docsWriterAgent, { name: 'design-diagram-writer' });
      writerSession = await harness.session();
    }

    const diagramResult = await runDiagramPhase(init, {
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

    return {
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
    return {
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
