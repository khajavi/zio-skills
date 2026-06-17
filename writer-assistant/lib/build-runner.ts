import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';

export interface BuildResult {
  success: boolean;
  exitCode: number;
  output: string;
  durationMs: number;
  buildSystem: string;
  buildCwd: string;
}

interface BuildConfig {
  buildSystem: string;
  buildCommand: string;
  buildCwd: string;
}

/**
 * Detect which documentation build system is in use
 * Tries: Docusaurus (website/), Docusaurus (root), MkDocs, Sphinx
 */
function detectBuildSystem(docsDir: string): BuildConfig | null {
  const parentDir = path.dirname(docsDir);

  // Check 1: Docusaurus in ../website/ (ZIO pattern)
  const docusaurusWebsitePackage = path.join(parentDir, 'website', 'package.json');
  if (fs.existsSync(docusaurusWebsitePackage)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(docusaurusWebsitePackage, 'utf-8'));
      if (pkg.dependencies?.['@docusaurus/core'] || pkg.devDependencies?.['@docusaurus/core']) {
        return {
          buildSystem: 'docusaurus',
          buildCommand: 'yarn build',
          buildCwd: path.join(parentDir, 'website'),
        };
      }
    } catch {
      // Continue to next check
    }
  }

  // Check 2: Docusaurus in ../package.json
  const docusaurusPackage = path.join(parentDir, 'package.json');
  if (fs.existsSync(docusaurusPackage)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(docusaurusPackage, 'utf-8'));
      if (pkg.dependencies?.['@docusaurus/core'] || pkg.devDependencies?.['@docusaurus/core']) {
        return {
          buildSystem: 'docusaurus',
          buildCommand: 'npm run build',
          buildCwd: parentDir,
        };
      }
    } catch {
      // Continue to next check
    }
  }

  // Check 3: MkDocs
  const mkdocsYml = path.join(parentDir, 'mkdocs.yml');
  if (fs.existsSync(mkdocsYml)) {
    return {
      buildSystem: 'mkdocs',
      buildCommand: 'mkdocs build',
      buildCwd: parentDir,
    };
  }

  // Check 4: Sphinx
  const sphinxConf = path.join(docsDir, 'conf.py');
  if (fs.existsSync(sphinxConf)) {
    return {
      buildSystem: 'sphinx',
      buildCommand: 'make html',
      buildCwd: docsDir,
    };
  }

  return null;
}

/**
 * Execute a single command and capture output
 */
function executeCommand(
  command: string,
  args: string[],
  cwd: string
): Promise<{ exitCode: number; output: string }> {
  return new Promise((resolve) => {
    let output = '';
    const proc = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });

    proc.stdout?.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(`[build] ${text}`);
    });

    proc.stderr?.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stderr.write(`[build-error] ${text}`);
    });

    proc.on('close', (exitCode) => {
      resolve({ exitCode: exitCode ?? 0, output });
    });

    proc.on('error', (error) => {
      resolve({ exitCode: 1, output: output + '\n' + error.message });
    });
  });
}

/**
 * Check if this is a Scala/ZIO project that requires sbt mdoc preprocessing
 */
function isScalaProject(parentDir: string): boolean {
  const buildSbt = path.join(parentDir, 'build.sbt');
  const sbtLock = path.join(parentDir, '.sbtopts');
  return fs.existsSync(buildSbt) || fs.existsSync(sbtLock);
}

/**
 * Execute the ZIO build pipeline: sbt mdoc → yarn install → yarn build
 */
async function executeZioBuildPipeline(docsDir: string, buildCwd: string): Promise<BuildResult> {
  const startTime = Date.now();
  const parentDir = path.dirname(docsDir);
  let output = '';

  // Step 1: Run sbt docs/mdoc
  console.log('[build-runner] Running prerequisite: sbt docs/mdoc\n');
  let result = await executeCommand('sbt', ['-v', 'docs/mdoc'], parentDir);
  output += result.output;
  if (result.exitCode !== 0) {
    const durationMs = Date.now() - startTime;
    return {
      success: false,
      exitCode: result.exitCode,
      output,
      durationMs,
      buildSystem: 'docusaurus',
      buildCwd,
    };
  }

  // Step 2: Run yarn install in website directory
  console.log('\n[build-runner] Running prerequisite: yarn install\n');
  result = await executeCommand('yarn', ['install'], buildCwd);
  output += result.output;
  if (result.exitCode !== 0) {
    const durationMs = Date.now() - startTime;
    return {
      success: false,
      exitCode: result.exitCode,
      output,
      durationMs,
      buildSystem: 'docusaurus',
      buildCwd,
    };
  }

  // Step 3: Run yarn build
  console.log('\n[build-runner] Running main build: yarn build\n');
  result = await executeCommand('yarn', ['build'], buildCwd);
  output += result.output;

  const durationMs = Date.now() - startTime;
  return {
    success: result.exitCode === 0,
    exitCode: result.exitCode,
    output,
    durationMs,
    buildSystem: 'docusaurus',
    buildCwd,
  };
}

/**
 * Execute a build command and capture output
 */
async function executeBuild(config: BuildConfig, docsDir: string): Promise<BuildResult> {
  const startTime = Date.now();
  const parentDir = path.dirname(docsDir);

  // Check if this is a ZIO-style project (Scala project with website subdirectory)
  if (
    isScalaProject(parentDir) &&
    config.buildCwd.includes('website') &&
    fs.existsSync(path.join(docsDir, '..', 'build.sbt'))
  ) {
    console.log('[build-runner] Detected Scala project with website subdirectory (ZIO pattern)');
    console.log('[build-runner] Using full build pipeline: sbt mdoc → yarn install → yarn build\n');
    return executeZioBuildPipeline(docsDir, config.buildCwd);
  }

  // Standard single-command build
  const [command, ...args] = config.buildCommand.split(' ');
  let output = '';
  const proc = spawn(command, args, {
    cwd: config.buildCwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });

  proc.stdout?.on('data', (data) => {
    const text = data.toString();
    output += text;
    process.stdout.write(`[build] ${text}`);
  });

  proc.stderr?.on('data', (data) => {
    const text = data.toString();
    output += text;
    process.stderr.write(`[build-error] ${text}`);
  });

  return new Promise((resolve) => {
    proc.on('close', (exitCode) => {
      const durationMs = Date.now() - startTime;
      resolve({
        success: exitCode === 0,
        exitCode: exitCode ?? 0,
        output,
        durationMs,
        buildSystem: config.buildSystem,
        buildCwd: config.buildCwd,
      });
    });

    proc.on('error', (error) => {
      const durationMs = Date.now() - startTime;
      resolve({
        success: false,
        exitCode: 1,
        output: output + '\n' + error.message,
        durationMs,
        buildSystem: config.buildSystem,
        buildCwd: config.buildCwd,
      });
    });
  });
}

export interface PreviewResult {
  url: string;
  pid: number;
  buildSystem: string;
  previewCwd: string;
}

function getPreviewPort(buildSystem: string): number {
  return buildSystem === 'mkdocs' ? 8000 : 3000;
}

function pollPort(port: number, intervalMs: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const net = require('node:net');
    const deadline = Date.now() + timeoutMs;
    const check = () => {
      const client = new net.Socket();
      client.setTimeout(500);
      client
        .connect(port, '127.0.0.1', () => {
          client.destroy();
          resolve();
        })
        .on('error', () => {
          client.destroy();
          if (Date.now() >= deadline) {
            reject(new Error(`Preview server did not start on port ${port} within ${timeoutMs}ms`));
          } else {
            setTimeout(check, intervalMs);
          }
        })
        .on('timeout', () => {
          client.destroy();
          if (Date.now() >= deadline) {
            reject(new Error(`Preview server did not start on port ${port} within ${timeoutMs}ms`));
          } else {
            setTimeout(check, intervalMs);
          }
        });
    };
    check();
  });
}

/**
 * Start a detached documentation preview server and return once it is ready.
 * The server keeps running in the background after this function returns.
 */
export async function runPreview(docsDir: string): Promise<PreviewResult> {
  const config = detectBuildSystem(docsDir);
  if (!config) {
    const parentDir = path.dirname(docsDir);
    throw new Error(
      `No supported documentation build system detected in ${docsDir}.\n` +
        `Checked:\n` +
        `  - ${path.join(parentDir, 'website', 'package.json')} (Docusaurus)\n` +
        `  - ${path.join(parentDir, 'package.json')} (Docusaurus)\n` +
        `  - ${path.join(parentDir, 'mkdocs.yml')} (MkDocs)\n`
    );
  }

  // Map build commands to preview commands
  let previewCmd: string;
  let previewArgs: string[];
  if (config.buildSystem === 'docusaurus') {
    if (config.buildCommand.startsWith('yarn')) {
      previewCmd = 'yarn';
      previewArgs = ['start'];
    } else {
      previewCmd = 'npm';
      previewArgs = ['run', 'start'];
    }
  } else if (config.buildSystem === 'mkdocs') {
    previewCmd = 'mkdocs';
    previewArgs = ['serve'];
  } else {
    throw new Error(`Preview not supported for build system: ${config.buildSystem}`);
  }

  const port = getPreviewPort(config.buildSystem);
  const url = `http://localhost:${port}`;

  console.log(`[preview-runner] Starting ${config.buildSystem} dev server in background`);
  console.log(`[preview-runner] Working directory: ${config.buildCwd}`);
  console.log(`[preview-runner] Command: ${previewCmd} ${previewArgs.join(' ')}`);
  console.log(`[preview-runner] URL: ${url}`);

  const proc = spawn(previewCmd, previewArgs, {
    cwd: config.buildCwd,
    stdio: 'ignore',
    detached: true,
  });
  proc.unref();

  const pid = proc.pid ?? 0;
  console.log(`[preview-runner] Server PID: ${pid}`);
  console.log(`[preview-runner] Waiting for server to be ready on port ${port}...`);

  await pollPort(port, 2000, 120_000);

  console.log(`[preview-runner] ✓ Server ready at ${url}`);

  return {
    url,
    pid,
    buildSystem: config.buildSystem,
    previewCwd: config.buildCwd,
  };
}

/**
 * Auto-detect build system and run build
 * Throws if no supported build system is found
 */
export async function runBuild(docsDir: string): Promise<BuildResult> {
  const config = detectBuildSystem(docsDir);

  if (!config) {
    const parentDir = path.dirname(docsDir);
    throw new Error(
      `No supported documentation build system detected in ${docsDir}.\n` +
        `Checked:\n` +
        `  - ${path.join(parentDir, 'website', 'package.json')} (Docusaurus)\n` +
        `  - ${path.join(parentDir, 'package.json')} (Docusaurus)\n` +
        `  - ${path.join(parentDir, 'mkdocs.yml')} (MkDocs)\n` +
        `  - ${path.join(docsDir, 'conf.py')} (Sphinx)\n` +
        `Supported systems: Docusaurus, MkDocs, Sphinx`
    );
  }

  console.log(`[build-runner] Detected ${config.buildSystem} build system`);
  console.log(`[build-runner] Working directory: ${config.buildCwd}\n`);

  return executeBuild(config, docsDir);
}
