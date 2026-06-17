import 'dotenv/config.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { FlueContext } from '@flue/runtime';
import { runBuild } from '../lib/build-runner.js';

export interface CheckWebsiteResult {
  success: boolean;
  buildSystem: string;
  buildCwd: string;
  durationMs: number;
  errorCount: number;
  errors: string[];
  output: string;
  mdocRan: boolean;
  mdocSuccess: boolean;
}

/**
 * Parse website build errors from output.
 * Filters for lines containing error keywords, excluding noise.
 */
function parseWebsiteBuildErrors(output: string): string[] {
  const lines = output.split('\n');
  const errors: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip noise: progress, downloads, info messages
    if (
      trimmed.includes('[info]') ||
      trimmed.includes('[success]') ||
      trimmed.includes('download') ||
      trimmed.includes('Downloading') ||
      trimmed.includes('yarn add') ||
      trimmed.includes('npm notice') ||
      trimmed.match(/^\d+%|Working/)
    ) {
      continue;
    }

    // Capture error/warning lines
    if (
      trimmed.toLowerCase().includes('error:') ||
      trimmed.toLowerCase().includes('[error]') ||
      trimmed.toLowerCase().includes('failed') ||
      trimmed.toLowerCase().includes('error ts') ||
      trimmed.includes('ERROR -') ||
      trimmed.includes('WARNING -') ||
      trimmed.includes('broken link') ||
      trimmed.includes('✖')
    ) {
      errors.push(line);
    }
  }

  return errors;
}

export async function run({ payload }: FlueContext) {
  const { projectRoot, docsDir: inputDocsDir, runMdoc = false } = payload as {
    projectRoot: string;
    docsDir?: string;
    /** Run `sbt docs/mdoc` before checking the website. Default: false. */
    runMdoc?: boolean;
  };

  if (!projectRoot) throw new Error('payload.projectRoot is required');
  if (!fs.existsSync(projectRoot)) throw new Error(`projectRoot not found: ${projectRoot}`);

  const docsDir = inputDocsDir
    ? path.isAbsolute(inputDocsDir)
      ? inputDocsDir
      : path.resolve(projectRoot, inputDocsDir)
    : path.join(projectRoot, 'docs');

  if (!fs.existsSync(docsDir)) {
    throw new Error(`docs directory not found: ${docsDir}`);
  }

  console.log(`[check-website] Starting website build check`);
  console.log(`  Project root: ${projectRoot}`);
  console.log(`  Docs directory: ${docsDir}`);
  console.log(`  Run mdoc first: ${runMdoc}`);

  let mdocSuccess = true;

  if (runMdoc) {
    console.log('\n[Step 1/2] Running sbt docs/mdoc...');
    const result = spawnSync('sbt', ['docs/mdoc'], {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 600_000,
      shell: false,
      stdio: 'inherit',
    });
    mdocSuccess = (result.status ?? 1) === 0;
    if (mdocSuccess) {
      console.log('[Step 1/2] ✓ mdoc succeeded');
    } else {
      console.error('[Step 1/2] ✗ mdoc FAILED');
      return {
        success: false,
        buildSystem: 'unknown',
        buildCwd: docsDir,
        durationMs: 0,
        errorCount: 1,
        errors: ['sbt docs/mdoc failed'],
        output: '',
        mdocRan: true,
        mdocSuccess: false,
      } satisfies CheckWebsiteResult;
    }
  }

  const stepLabel = runMdoc ? '[Step 2/2]' : '[Step 1/1]';
  console.log(`\n${stepLabel} Checking website build...`);
  const startMs = Date.now();

  try {
    const buildResult = await runBuild(docsDir);
    const durationMs = Date.now() - startMs;

    const errors = parseWebsiteBuildErrors(buildResult.output);
    const success = buildResult.success && errors.length === 0;

    console.log(`\n[check-website] ${success ? '✓ PASSED' : '✗ FAILED'} (${durationMs}ms)`);
    if (errors.length > 0) {
      console.log(`  Errors (${errors.length}):`);
      errors.forEach(e => console.log(`    ${e}`));
    }

    return {
      success,
      buildSystem: buildResult.buildSystem,
      buildCwd: buildResult.buildCwd,
      durationMs,
      errorCount: errors.length,
      errors,
      output: buildResult.output,
      mdocRan: runMdoc,
      mdocSuccess,
    } satisfies CheckWebsiteResult;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const durationMs = Date.now() - startMs;

    console.error(`\n[check-website] ✗ Build check failed: ${errorMsg}`);

    return {
      success: false,
      buildSystem: 'unknown',
      buildCwd: docsDir,
      durationMs,
      errorCount: 1,
      errors: [errorMsg],
      output: errorMsg,
      mdocRan: runMdoc,
      mdocSuccess,
    };
  }
}
