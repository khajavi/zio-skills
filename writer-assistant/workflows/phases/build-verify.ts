import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runBuild, parseBuildErrors } from '../../lib/build-runner.js';

export interface BuildVerifyResult {
  success: boolean;
  buildSystem: string;
  durationMs: number;
  skipped: boolean;
  rounds: number;
}

export async function runBuildVerifyPhase(
  harness: any,
  session: any,
  options: {
    docsDir: string;
    projectRoot: string;
    sessionName: string;
    skipPhases: string[];
    maxRounds?: number;
  }
): Promise<BuildVerifyResult> {
  const { docsDir, projectRoot, sessionName, skipPhases, maxRounds = 3 } = options;

  if (skipPhases.includes('verifyBuild')) {
    console.log('\n[Phase 7] ⏭ Build verification skipped');
    return { success: true, buildSystem: 'skipped', durationMs: 0, skipped: true, rounds: 0 };
  }

  console.log(`\n[Phase 7] Build Verification: Verifying documentation builds (max ${maxRounds} fix rounds)...`);
  const buildStartMs = Date.now();
  let buildSystem = 'unknown';

  try {
    const initialBuild = await runBuild(docsDir);
    buildSystem = initialBuild.buildSystem;

    if (initialBuild.success && parseBuildErrors(initialBuild.output).length === 0) {
      console.log(`[Phase 7] ✓ Build passed on first attempt (${buildSystem})`);

      let checkSuccess = true;
      if (fs.existsSync(path.join(projectRoot, 'build.sbt'))) {
        console.log('[Phase 7] Running sbt check...');
        const checkResult = spawnSync('sbt', ['check'], {
          cwd: projectRoot,
          encoding: 'utf-8',
          timeout: 300_000,
          shell: false,
        });
        checkSuccess = (checkResult.status ?? 1) === 0;
        console.log(`[Phase 7] sbt check: ${checkSuccess ? '✓ PASSED' : '✗ FAILED'}`);
      }

      return { success: checkSuccess, buildSystem, durationMs: Date.now() - buildStartMs, skipped: false, rounds: 0 };
    }

    let currentErrors = parseBuildErrors(initialBuild.output);
    console.log(`[Phase 7] Found ${currentErrors.length} error(s), starting fix loop`);

    if (!session) {
      session = await harness.session(sessionName);
    }

    let round = 0;
    for (round = 1; round <= maxRounds; round++) {
      if (currentErrors.length === 0) break;
      console.log(`[Phase 7] Fix attempt ${round}/${maxRounds} (${currentErrors.length} error(s))`);
      const errorList = currentErrors.map((e) => `  ${e}`).join('\n');
      await session.prompt(
        `Fix the following documentation website build errors in ${projectRoot}.\n\nErrors:\n${errorList}\n\nFor each error: read the file, identify the root cause (broken link, missing file, wrong path), fix it. If a link target doesn't exist, either correct the path or remove the link. Report each fix applied.`
      );
      const reBuild = await runBuild(docsDir);
      currentErrors = parseBuildErrors(reBuild.output);
      buildSystem = reBuild.buildSystem;
      if (currentErrors.length === 0) {
        console.log(`[Phase 7] ✓ All errors fixed after ${round} round(s)`);
        break;
      }
      console.log(`[Phase 7] Still ${currentErrors.length} error(s) after round ${round}`);
    }

    const docsBuildSuccess = currentErrors.length === 0;
    console.log(`[Phase 7] ${docsBuildSuccess ? '✓' : '⚠'} Build verification complete (${round} fix round(s))`);

    // Run sbt check as final lint gate for Scala projects
    let checkSuccess = true;
    if (docsBuildSuccess && fs.existsSync(path.join(projectRoot, 'build.sbt'))) {
      console.log('[Phase 7] Running sbt check...');
      const checkResult = spawnSync('sbt', ['check'], {
        cwd: projectRoot,
        encoding: 'utf-8',
        timeout: 300_000,
        shell: false,
      });
      checkSuccess = (checkResult.status ?? 1) === 0;
      console.log(`[Phase 7] sbt check: ${checkSuccess ? '✓ PASSED' : '✗ FAILED'}`);
    }

    const success = docsBuildSuccess && checkSuccess;
    return { success, buildSystem, durationMs: Date.now() - buildStartMs, skipped: false, rounds: round };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('No supported documentation build system detected')) {
      console.log('[Phase 7] ⚠ No documentation build system detected, skipping');
      return { success: true, buildSystem: 'none', durationMs: Date.now() - buildStartMs, skipped: true, rounds: 0 };
    }
    console.log(`[Phase 7] ⚠ Build verification failed: ${msg}`);
    return { success: false, buildSystem, durationMs: Date.now() - buildStartMs, skipped: false, rounds: 0 };
  }
}
