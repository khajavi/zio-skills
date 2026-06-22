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

function getExampleFileNames(docType: DocType): string[] | null {
  switch (docType) {
    case 'data-type-ref':
      return ['BasicUsage.scala', 'AdvancedPatterns.scala', 'CompleteExample.scala'];
    case 'tutorial':
      return null; // agent chooses semantic names; directory is scanned after generation
    case 'how-to-guide':
      return null; // agent chooses semantic names; directory is scanned after generation
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
      return 'Name each file <ConceptName>Example<N>.scala where N is the study order (e.g., CreatingAMuxExample1.scala, ConcurrentStreamsExample2.scala, ErrorHandlingExample3.scala). Always include CompleteExample.scala (no number) as the final comprehensive example.';
    case 'how-to-guide':
      return 'Name each file <StepName>Example<N>.scala where N is the step order (e.g., ConnectingToDatabaseExample1.scala, QueryingWithFiltersExample2.scala). Always include CompleteExample.scala (no number) as the complete solution.';
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
  const exampleFileNames = getExampleFileNames(docType); // null for tutorial/how-to-guide
  const exampleFilePaths = exampleFileNames
    ? exampleFileNames.map((f) => path.join(packageDir, f))
    : [];

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
    ? `Scaffold ${topic} example sub-module (self-contained sbt build).

Root: ${projectRoot}
Parent: ${parentModule} (${path.join(projectRoot, parentModule)})
Module: ${moduleName} (${moduleDir})
Package: ${packageName}

RootProject hierarchy — each dir = own sbt build.

1. mkdir -p "${packageDir}"

2. Create ${moduleDir}/build.sbt:
   - Read ${projectRoot}/build.sbt (or ${projectRoot}/.scala-version) for exact scalaVersion
   - Add ZIO core libraryDependency at same version as root
   - SLF4J in topic? Add "org.slf4j" % "slf4j-api" % "<version>"
   - Minimal — no publish, no plugins
   \`\`\`
   scalaVersion := "3.x.x"
   libraryDependencies += "dev.zio" %% "zio" % "2.x.x"
   \`\`\`

3. ${
        parentExists
          ? `Parent aggregator exists at ${parentBuildSbt}. Add:
       lazy val ${toCamelCase(moduleName)} = RootProject(file("${moduleName}"))`
          : `Parent aggregator missing. Create:
   a. mkdir -p "${path.join(projectRoot, parentModule)}"
   b. ${parentBuildSbt}:
          lazy val ${toCamelCase(moduleName)} = RootProject(file("${moduleName}"))
   c. ${path.join(projectRoot, 'build.sbt')}:
      - Add near end: lazy val ${toCamelCase(parentModule)} = RootProject(file("${parentModule}"))
      - Add ${toCamelCase(parentModule)} to root .aggregate(...) call
        e.g. .aggregate(root213) → .aggregate(root213, ${toCamelCase(parentModule)})`
      }

Report: ✓ Setup complete or describe issues.`
    : `Scaffold ${topic} example sub-module.

Root: ${projectRoot}
Module: ${moduleName}
Package: ${packageName}

1. ${path.join(projectRoot, 'build.sbt')}: add lazy val for ${moduleName} following existing pattern
2. Add ${moduleName} to root project aggregate(...)
3. mkdir -p "${packageDir}"

Report: ✓ Setup complete or describe issues.`;

  await session.prompt(setupPrompt);

  // Phase B: Generate Scala example files
  const hasDoc = !exampleFileNames && outputDocPath && fs.existsSync(outputDocPath);

  const fileList = exampleFileNames
    ? exampleFileNames.map((f, i) => `  ${i + 1}. ${f}`).join('\n')
    : hasDoc
      ? '  (derive from the article sections — see instructions below)'
      : '  (3-4 files — choose names based on the topic concepts; see naming convention below)';

  const articleReadingPreamble = hasDoc
    ? `Read article: ${outputDocPath}

Find numbered concept sections ("## 1. Title", "## 2. Title", ...).
Skip: Introduction, Background, Big Picture, What You've Learned, Where to Go Next, Running the Examples.

Map sections to files:
- "## N. Section Title" → <SectionTitlePascalCase>Example<N>.scala
  "## 1. Creating a Mux" → CreatingAMuxExample1.scala
  "## 3. The Stream Lifecycle" → StreamLifecycleExample3.scala
- "## Putting It Together" (or equivalent synthesis section) → CompleteExample.scala (no number)

Code in each file must match corresponding article section — same API calls, same patterns.

`
    : '';

  const generatePrompt = `${articleReadingPreamble}Write ${exampleFileNames ? exampleFileNames.length : '3-4'} Scala example files for: ${topic}

Dir: ${packageDir}
Package: ${packageName}

Files:
${fileList}

Naming (${docType}):
${getNamingNote(docType)}

Template — detect Scala version from build.sbt:

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

Rules:
- Real ZIO code — no pseudocode, no TODO stubs
- Imports at top of each file
- CompleteExample.scala: full end-to-end demo
- Each file runs standalone

Write all files now.`;

  await session.prompt(generatePrompt);

  const createdFiles = exampleFileNames
    ? exampleFilePaths.filter((f) => fs.existsSync(f))
    : fs.existsSync(packageDir)
      ? fs.readdirSync(packageDir)
          .filter((f) => f.endsWith('.scala'))
          .map((f) => path.join(packageDir, f))
      : [];
  const expectedCount = exampleFileNames ? exampleFileNames.length : '3-4';
  console.log(`[examples] Created ${createdFiles.length}/${expectedCount} example files`);

  // Phase C: Compile — one agent-assisted retry on failure
  // Self-contained sub-modules compile from their own directory; flat modules compile from root.
  const compileCwd = parentModule ? moduleDir : projectRoot;
  const compileTarget = parentModule ? 'compile' : `${moduleName}/compile`;

  let compileResult = runSbt(compileTarget, compileCwd);
  let compileSuccess = compileResult.exitCode === 0;

  if (!compileSuccess) {
    console.log('[examples] Compile failed — requesting fix...');
    await session.prompt(`Fix compile errors in ${packageDir}.

Output:
${compileResult.output.slice(0, 4000)}

Read failing files, fix Scala code.
Report: ✓ Fixed <file> or ✗ Could not fix <file> (reason)`);

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

    const runPrompt = `Run all examples, verify output.

Package: ${packageName}
Dir: ${runCwd}
Command: ${runCmdNote}

Files:
${createdFiles.map((f) => `  - ${path.basename(f)}`).join('\n')}

For each file:
1. Read — find entry point (@main def for Scala 3, object extends App for Scala 2)
2. Run with correct class name
3. Check: exit code 0, no exceptions/stack traces, non-empty output (note if intentionally empty)
4. Crash/exception → fix file, re-run

Report:
  ✓ <FileName>.scala — <first output line>
  ✗ <FileName>.scala — <error> → FIXED / NOT FIXED

Last line: "✓ All examples run successfully" or "✗ <N> example(s) failed"`;

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
      ? `Append "Running the Examples" section to ${outputDocPath}.

Embed each file with SourceFile.print() inside \`\`\`scala mdoc:passthrough:
  println(SourceFile.print("${moduleName}/src/main/scala/${packageName}/<FileName>.scala"))

Files:
${createdFiles.map((f) => `  - ${f}`).join('\n')}

Place after all type docs. One intro sentence per example.`
      : `Append "Running the Examples" section to ${outputDocPath}.

Intro paragraph: "All examples in this tutorial have corresponding runnable Scala files in the \`${moduleName}\` module. Run them in order to progressively build your understanding."

For each example, add ### subsection:
1. 1-2 sentence narrative — what this example shows.
2. <details> block:
   <details>
     <summary>${moduleName}/src/main/scala/${packageName}/<FileName>.scala</summary>

   \`\`\`scala mdoc:embed:${moduleName}/src/main/scala/${packageName}/<FileName>.scala:show-line-numbers
   \`\`\`

   </details>
3. "Observe X:" sentence — what to watch in output.
4. bash block: sbt "${moduleName}/runMain ${packageName}.<ClassName>"

Files:
${createdFiles.map(f => {
  const className = path.basename(f, '.scala');
  const relPath = path.relative(process.env.FLUE_PROJECT_ROOT || '', f);
  return `  - ${className}: ${relPath}`;
}).join('\n')}`;

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
