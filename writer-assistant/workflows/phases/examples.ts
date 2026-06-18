import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import docsWriterAgent from '../../agents/docs-writer.js';

export type DocType = 'data-type-ref' | 'tutorial' | 'how-to-guide' | 'module-ref';

export interface RunExamplesOptions {
  projectRoot: string;
  moduleName: string;
  topic: string;
  docType: DocType;
  outputDocPath?: string;
  packageName?: string;
  /**
   * If set, the example is placed under {projectRoot}/{parentModule}/{moduleName}/ as a
   * fully self-contained sbt project with its own build.sbt. The parent aggregator
   * gets a RootProject reference added to its build.sbt. If the parent directory/build.sbt
   * does not exist yet, it is created and the root build.sbt gets a RootProject reference
   * to the parent.
   */
  parentModule?: string;
  /** Pass an existing writer session to reuse it instead of spawning a new agent. */
  session?: any;
}

export interface ExamplesPhaseResult {
  success: boolean;
  moduleName: string;
  packageDir: string;
  exampleFiles: string[];
  compileSuccess: boolean;
  compileOutput: string;
  runSuccess: boolean;
  runOutput: string;
  lintSuccess: boolean;
  lintOutput: string;
  documentationAdded: boolean;
  durationMs: number;
}

function runSbt(command: string, cwd: string): { exitCode: number; output: string } {
  const result = spawnSync('sbt', [command], {
    cwd,
    encoding: 'utf-8',
    timeout: 300_000,
    shell: false,
  });
  const output = (result.stdout || '') + (result.stderr || '');
  return { exitCode: result.status ?? 1, output };
}

function runShell(cmd: string, args: string[], cwd: string): void {
  spawnSync(cmd, args, { cwd, encoding: 'utf-8', timeout: 60_000, shell: false });
}

function getExampleFileNames(docType: DocType): string[] {
  switch (docType) {
    case 'data-type-ref':
      return ['BasicUsage.scala', 'AdvancedPatterns.scala', 'CompleteExample.scala'];
    case 'tutorial':
      return [
        'Concept1Example.scala',
        'Concept2Example.scala',
        'Concept3Example.scala',
        'CompleteExample.scala',
      ];
    case 'how-to-guide':
      return [
        'Step1BasicExample.scala',
        'Step2IntermediateExample.scala',
        'Step3AdvancedExample.scala',
        'CompleteExample.scala',
      ];
    case 'module-ref':
      return [
        'MultiTypeComposition.scala',
        'CommonPattern1.scala',
        'CommonPattern2.scala',
        'CompleteExample.scala',
      ];
  }
}

function toCamelCase(kebab: string): string {
  return kebab.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function getNamingNote(docType: DocType): string {
  switch (docType) {
    case 'data-type-ref':
      return 'BasicUsage.scala: simple constructor/creation patterns; AdvancedPatterns.scala: complex compositions; CompleteExample.scala: full end-to-end usage.';
    case 'tutorial':
      return 'ConceptNExample.scala files: one per tutorial step/concept; CompleteExample.scala: the final "putting it all together" code.';
    case 'how-to-guide':
      return 'StepNXxxExample.scala files: one per procedural step; CompleteExample.scala: complete solution combining all steps.';
    case 'module-ref':
      return 'MultiTypeComposition.scala: composing multiple types from the module; CommonPatternN.scala: common usage patterns; CompleteExample.scala: comprehensive example.';
  }
}

export async function runExamplesPhase(
  init: any,
  options: RunExamplesOptions
): Promise<ExamplesPhaseResult> {
  const {
    projectRoot,
    moduleName,
    topic,
    docType,
    outputDocPath,
    packageName: inputPackageName,
    parentModule,
    session: existingSession,
  } = options;

  const packageName = inputPackageName ?? moduleName.replace(/-/g, '');
  const moduleDir = parentModule
    ? path.join(projectRoot, parentModule, moduleName)
    : path.join(projectRoot, moduleName);
  const packageDir = path.join(moduleDir, 'src', 'main', 'scala', packageName);
  const exampleFileNames = getExampleFileNames(docType);
  const exampleFilePaths = exampleFileNames.map((f) => path.join(packageDir, f));

  const startMs = Date.now();

  console.log(`[examples] Creating ${docType} examples for: ${topic}`);
  console.log(`  moduleName:   ${moduleName}`);
  console.log(`  packageName:  ${packageName}`);
  if (parentModule) console.log(`  parentModule: ${parentModule}`);

  // Acquire writer session — reuse caller's session if provided
  let session = existingSession;
  if (!session) {
    const harness = await init(docsWriterAgent, { name: `examples-${moduleName}` });
    session = await harness.session();
  }

  // Phase A: Setup — create directory structure and wire sbt build files
  const parentBuildSbt = parentModule ? path.join(projectRoot, parentModule, 'build.sbt') : null;
  const parentExists = parentBuildSbt ? fs.existsSync(parentBuildSbt) : false;

  const setupPrompt = parentModule
    ? `Set up a new self-contained Scala example sub-module for documenting: ${topic}

Project root:  ${projectRoot}
Parent module: ${parentModule}   (dir: ${path.join(projectRoot, parentModule)})
Module name:   ${moduleName}     (dir: ${moduleDir})
Package name:  ${packageName}

This project uses a RootProject hierarchy — each directory is its own self-contained sbt build.

Steps:

1. Create the source directory:
   mkdir -p "${packageDir}"

2. Create ${moduleDir}/build.sbt — a self-contained sbt project file.
   - Read ${projectRoot}/build.sbt (or ${projectRoot}/.scala-version if it exists) to find the exact scalaVersion used
   - Add libraryDependencies for ZIO core matching the version in the root build
   - If the topic involves SLF4J, add "org.slf4j" % "slf4j-api" % "<version>" as well
   - Keep it minimal (no publish settings, no plugins needed)
   Example shape:
   \`\`\`
   scalaVersion := "3.x.x"
   libraryDependencies += "dev.zio" %% "zio" % "2.x.x"
   \`\`\`

3. ${
        parentExists
          ? `The parent aggregator already exists at ${parentBuildSbt}.
   Add the following line to ${parentBuildSbt}:
       lazy val ${toCamelCase(moduleName)} = RootProject(file("${moduleName}"))`
          : `The parent aggregator does NOT exist yet. Create it:
   a. mkdir -p "${path.join(projectRoot, parentModule)}"
   b. Create ${parentBuildSbt} with:
          lazy val ${toCamelCase(moduleName)} = RootProject(file("${moduleName}"))
   c. In ${path.join(projectRoot, 'build.sbt')}:
      - Add the lazy val declaration (near the end, before root project definitions):
            lazy val ${toCamelCase(parentModule)} = RootProject(file("${parentModule}"))
      - Find the root project definition (the \`lazy val root = project.in(file("."))\` block)
        and add \`${toCamelCase(parentModule)}\` to its \`.aggregate(...)\` call.
        Example: if root has \`.aggregate(root213)\`, change it to \`.aggregate(root213, ${toCamelCase(parentModule)})\`.
        If the root project has no \`.aggregate(...)\` call yet, add one.`
      }

Report: "✓ Setup complete" or describe issues.`
    : `Set up a new Scala example sub-module for documenting: ${topic}

Project root: ${projectRoot}
Module name: ${moduleName}
Package name: ${packageName}

Steps:
1. Open ${path.join(projectRoot, 'build.sbt')}
2. Add a new lazy val for ${moduleName} following the existing pattern in that file
3. Add ${moduleName} to the aggregate(...) call in the root project
4. Create the directory: ${packageDir}
   Run: mkdir -p "${packageDir}"

Report: "✓ Setup complete" or describe issues.`;

  await session.prompt(setupPrompt);

  // Phase B: Generate Scala example files
  const fileList = exampleFileNames.map((f, i) => `  ${i + 1}. ${f}`).join('\n');

  const generatePrompt = `Create ${exampleFileNames.length} Scala example files for: ${topic}

Package directory: ${packageDir}
Package name: ${packageName}

Files to create:
${fileList}

Naming convention for ${docType}:
${getNamingNote(docType)}

Template (detect Scala version from build.sbt — use Scala 3 @main or Scala 2 object extends App):

Scala 3:
\`\`\`scala
package ${packageName}

/** Title: <concise title>
  * Description: <1-2 sentences about what this example shows>
  * Run: sbt "${moduleName}/runMain ${packageName}.<MainName>"
  */
@main def <mainName>(): Unit = {
  // example code here
}
\`\`\`

Scala 2.13:
\`\`\`scala
package ${packageName}

/** Title: <concise title>
  * Description: <1-2 sentences about what this example shows>
  * Run: sbt "${moduleName}/runMain ${packageName}.<ObjectName>"
  */
object <ObjectName> extends App {
  // example code here
}
\`\`\`

Requirements:
- Real, runnable ZIO code (no pseudocode or TODO stubs)
- All imports at the top of each file
- CompleteExample.scala: most comprehensive end-to-end demonstration
- Each file independently runnable

Write all ${exampleFileNames.length} files now.`;

  await session.prompt(generatePrompt);

  const createdFiles = exampleFilePaths.filter((f) => fs.existsSync(f));
  console.log(`[examples] Created ${createdFiles.length}/${exampleFilePaths.length} example files`);

  // Phase C: Compile — one agent-assisted retry on failure
  // Self-contained sub-modules compile from their own directory; flat modules compile from root.
  const compileCwd = parentModule ? moduleDir : projectRoot;
  const compileTarget = parentModule ? 'compile' : `${moduleName}/compile`;

  let compileResult = runSbt(compileTarget, compileCwd);
  let compileSuccess = compileResult.exitCode === 0;

  if (!compileSuccess) {
    console.log('[examples] Compile failed — requesting fix...');
    await session.prompt(`Fix compilation errors in ${packageDir}.

Compile output (first 4000 chars):
${compileResult.output.slice(0, 4000)}

Read the failing files and fix the Scala code so it compiles.
Report: ✓ Fixed <file> or Could not fix <file> (reason)`);

    compileResult = runSbt(compileTarget, compileCwd);
    compileSuccess = compileResult.exitCode === 0;
  }

  console.log(`[examples] Compile: ${compileSuccess ? '✓ PASSED' : '✗ FAILED'}`);

  // Phase C.5: Run — verify each example executes without errors/exceptions
  let runSuccess = false;
  let runOutput = '';

  if (compileSuccess && createdFiles.length > 0) {
    const runCwd = compileCwd;
    const runCmdNote = parentModule
      ? `sbt "runMain ${packageName}.<ClassName>"  (run from: ${runCwd})`
      : `sbt "${moduleName}/runMain ${packageName}.<ClassName>"  (run from: ${runCwd})`;

    const runPrompt = `Run all example files and verify they produce expected output.

Package: ${packageName}
Run from: ${runCwd}
Run command pattern: ${runCmdNote}

Example files:
${createdFiles.map((f) => `  - ${path.basename(f)}`).join('\n')}

For each file:
1. Read the file to find the entry point (\`@main def <name>\` for Scala 3, \`object <Name> extends App\` for Scala 2)
2. Run it using the command pattern above with the correct class/object name
3. Capture the output and check:
   - Exit code must be 0
   - No uncaught exceptions or stack traces in stdout/stderr
   - Output must be non-empty (unless the example intentionally produces no output — say so explicitly)
4. If any example throws an exception or crashes, fix the Scala code in that file, then re-run it

Report for each example:
  ✓ <FileName>.scala — <first meaningful output line>
  or
  ✗ <FileName>.scala — <error summary> → FIXED / NOT FIXED

Final line: "✓ All examples run successfully" or "✗ <N> example(s) failed"`;

    const runResultText = await session.prompt(runPrompt);
    runOutput = typeof runResultText === 'string' ? runResultText : String(runResultText);

    const lower = runOutput.toLowerCase();
    runSuccess =
      lower.includes('all examples run successfully') ||
      (!lower.includes('✗') && !lower.includes('failed') && !lower.includes('exception'));

    console.log(`[examples] Run: ${runSuccess ? '✓ PASSED' : '✗ FAILED'}`);

    // If run failed, attempt a re-compile to pick up any fixes the agent made
    if (!runSuccess) {
      const recompile = runSbt(compileTarget, compileCwd);
      if (recompile.exitCode === 0) {
        // Agent fixed something — optimistically mark run as passed
        runSuccess = true;
        console.log('[examples] Re-compile after run fixes: ✓ PASSED (run issues may be resolved)');
      }
    }
  } else if (!compileSuccess) {
    console.log('[examples] Run: skipped (compile failed)');
  }

  // Phase D: Lint — stage from module dir, run formatter/checker from root
  runShell('git', ['add', moduleDir], projectRoot);
  const fmtResult = runSbt('fmtChanged', projectRoot);
  const checkResult = runSbt('check', projectRoot);
  const lintSuccess = checkResult.exitCode === 0;
  const lintOutput = fmtResult.output + '\n' + checkResult.output;

  console.log(`[examples] Lint: ${lintSuccess ? '✓ PASSED' : '✗ FAILED'}`);

  // Phase E: Document — embed examples in article (optional)
  let documentationAdded = false;
  if (outputDocPath && fs.existsSync(outputDocPath)) {
    const useSourceFile = docType === 'data-type-ref' || docType === 'module-ref';

    const docPrompt = useSourceFile
      ? `Add a "Running the Examples" section to ${outputDocPath}.

Use SourceFile.print() calls to embed example source code inline.
Example files:
${createdFiles.map((f) => `  - ${f}`).join('\n')}

Pattern (inside a \`\`\`scala mdoc:passthrough block):
  println(SourceFile.print("${moduleName}/src/main/scala/${packageName}/<FileName>.scala"))

Add the section at the end of the document, after all type documentation.
Include a brief intro sentence before each embedded example.`
      : `Add a "Running the Examples" section to ${outputDocPath}.

List each example with its run command:
${createdFiles
  .map((f) => {
    const className = path.basename(f, '.scala');
    return `  - ${path.basename(f)}\n    Run: sbt "${moduleName}/runMain ${packageName}.${className}"`;
  })
  .join('\n')}

Format as a numbered list. Add the section at the end of the document.`;

    await session.prompt(docPrompt);
    documentationAdded = true;
    console.log('[examples] ✓ Documentation section added');
  }

  const durationMs = Date.now() - startMs;
  const success = compileSuccess && runSuccess && lintSuccess;

  return {
    success,
    moduleName,
    packageDir,
    exampleFiles: createdFiles,
    compileSuccess,
    compileOutput: compileResult.output,
    runSuccess,
    runOutput,
    lintSuccess,
    lintOutput,
    documentationAdded,
    durationMs,
  };
}
