import 'dotenv/config.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { FlueContext } from '@flue/runtime';
import docsWriterAgent from '../agents/docs-writer.js';

export interface WriteExamplesResult {
  success: boolean;
  moduleName: string;
  packageDir: string;
  exampleFiles: string[];
  compileSuccess: boolean;
  compileOutput: string;
  lintSuccess: boolean;
  lintOutput: string;
  documentationAdded: boolean;
  durationMs: number;
}

type DocType = 'data-type-ref' | 'tutorial' | 'how-to-guide' | 'module-ref';

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

function runShell(cmd: string, args: string[], cwd: string): { exitCode: number; output: string } {
  const result = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf-8',
    timeout: 60_000,
    shell: false,
  });
  const output = (result.stdout || '') + (result.stderr || '');
  return { exitCode: result.status ?? 1, output };
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

export async function run({ init, payload }: FlueContext) {
  const {
    projectRoot,
    moduleName,
    topic,
    docType,
    outputDocPath,
    packageName: inputPackageName,
  } = payload as {
    projectRoot: string;
    moduleName: string;
    topic: string;
    docType: DocType;
    outputDocPath?: string;
    packageName?: string;
  };

  if (!projectRoot) throw new Error('payload.projectRoot is required');
  if (!moduleName) throw new Error('payload.moduleName is required');
  if (!topic) throw new Error('payload.topic is required');
  if (!docType) throw new Error('payload.docType is required');
  if (!fs.existsSync(projectRoot)) throw new Error(`projectRoot not found: ${projectRoot}`);

  const validDocTypes: DocType[] = ['data-type-ref', 'tutorial', 'how-to-guide', 'module-ref'];
  if (!validDocTypes.includes(docType)) {
    throw new Error(`docType must be one of: ${validDocTypes.join(', ')}`);
  }

  const packageName = inputPackageName ?? moduleName.replace(/-/g, '');
  const packageDir = path.join(projectRoot, moduleName, 'src', 'main', 'scala', packageName);
  const exampleFileNames = getExampleFileNames(docType);
  const exampleFilePaths = exampleFileNames.map(f => path.join(packageDir, f));

  const startMs = Date.now();

  console.log(`[write-examples] Creating examples for: ${topic}`);
  console.log(`  projectRoot:   ${projectRoot}`);
  console.log(`  moduleName:    ${moduleName}`);
  console.log(`  packageName:   ${packageName}`);
  console.log(`  docType:       ${docType}`);
  console.log(`  outputDocPath: ${outputDocPath ?? '(not provided)'}`);

  // Phase 1: Setup — agent creates build.sbt entry and directory structure
  console.log('\n[write-examples] Phase 1: Setup');
  const harness = await init(docsWriterAgent, { name: 'write-examples' });
  const session = await harness.session();

  const setupPrompt = `Set up a new Scala example sub-module for documenting: ${topic}

Project root: ${projectRoot}
Module name: ${moduleName}
Package name: ${packageName}

Steps to complete:
1. Open ${path.join(projectRoot, 'build.sbt')}
2. Add a new lazy val for this module following the existing pattern in the file (look at how other example modules are defined)
3. Add ${moduleName} to the aggregate(...) call so it's included in root project builds
4. Create the directory: ${packageDir}
   - Run: mkdir -p "${packageDir}"

Report when done: "✓ Setup complete" or describe any issues encountered.`;

  await session.prompt(setupPrompt);

  // Phase 2: Generate Examples
  console.log('\n[write-examples] Phase 2: Generate Examples');

  const fileList = exampleFileNames.map((f, i) => `  ${i + 1}. ${f}`).join('\n');

  const generatePrompt = `Create ${exampleFileNames.length} Scala example files for: ${topic}

Package directory: ${packageDir}
Package name: ${packageName}

Files to create:
${fileList}

Naming convention for ${docType}:
${getNamingNote(docType)}

Each file must follow this template (detect Scala version from build.sbt — use Scala 3 @main or Scala 2 object extends App accordingly):

Scala 3 template:
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

Scala 2.13 template:
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
- Use real, runnable ZIO code (not pseudocode or placeholder TODOs)
- Import all required ZIO and library types at the top of each file
- CompleteExample.scala must be the most comprehensive, end-to-end demonstration
- Each file should be self-contained and independently runnable

Write all ${exampleFileNames.length} files now.`;

  await session.prompt(generatePrompt);

  const createdFiles = exampleFilePaths.filter(f => fs.existsSync(f));
  console.log(`[write-examples] Created ${createdFiles.length}/${exampleFilePaths.length} example files`);

  // Phase 3: Compile
  console.log('\n[write-examples] Phase 3: Compile');
  let compileResult = runSbt(`${moduleName}/compile`, projectRoot);
  let compileSuccess = compileResult.exitCode === 0;

  if (!compileSuccess) {
    console.log('[write-examples] Compile failed — requesting agent fix...');
    const fixPrompt = `Fix compilation errors in ${packageDir}.

Compile output (first 4000 chars):
${compileResult.output.slice(0, 4000)}

Read the failing files and fix the Scala code so it compiles.
Report each fix as:
  ✓ Fixed <file>
or
  Could not fix <file> (reason)`;

    await session.prompt(fixPrompt);

    compileResult = runSbt(`${moduleName}/compile`, projectRoot);
    compileSuccess = compileResult.exitCode === 0;
  }

  console.log(`[write-examples] Compile: ${compileSuccess ? '✓ PASSED' : '✗ FAILED'}`);

  // Phase 4: Lint
  console.log('\n[write-examples] Phase 4: Lint');
  runShell('git', ['add', path.join(projectRoot, moduleName)], projectRoot);
  const fmtResult = runSbt('fmtChanged', projectRoot);
  const checkResult = runSbt('check', projectRoot);
  const lintSuccess = checkResult.exitCode === 0;
  const lintOutput = fmtResult.output + '\n' + checkResult.output;

  console.log(`[write-examples] Lint: ${lintSuccess ? '✓ PASSED' : '✗ FAILED'}`);

  // Phase 5: Document (only when outputDocPath provided and file exists)
  let documentationAdded = false;
  if (outputDocPath && fs.existsSync(outputDocPath)) {
    console.log('\n[write-examples] Phase 5: Document');

    const useSourceFile = docType === 'data-type-ref' || docType === 'module-ref';

    const docPrompt = useSourceFile
      ? `Add a "Running the Examples" section to ${outputDocPath}.

Use SourceFile.print() calls to embed the example source code inline in the document.
Example files:
${createdFiles.map(f => `  - ${f}`).join('\n')}

Pattern for each example (inside a \`\`\`scala mdoc:passthrough block):
  println(SourceFile.print("${moduleName}/src/main/scala/${packageName}/<FileName>.scala"))

Add the section at the very end of the document, after all type documentation.
Include a brief intro sentence before each embedded example.`
      : `Add a "Running the Examples" section to ${outputDocPath}.

List each example with its run command:
${createdFiles.map(f => {
  const className = path.basename(f, '.scala');
  return `  - ${path.basename(f)}\n    Run: sbt "${moduleName}/runMain ${packageName}.${className}"`;
}).join('\n')}

Format as a numbered list with a short description for each entry.
Add the section at the very end of the document.`;

    await session.prompt(docPrompt);
    documentationAdded = true;
    console.log('[write-examples] ✓ Documentation section added');
  } else if (outputDocPath) {
    console.log(`[write-examples] Skipping Phase 5 — outputDocPath not found: ${outputDocPath}`);
  }

  const durationMs = Date.now() - startMs;
  const success = compileSuccess && lintSuccess;

  console.log(`\n[write-examples] ${success ? '✓ SUCCESS' : '⚠ PARTIAL'} (${durationMs}ms)`);
  console.log(`  Examples: ${createdFiles.length} files`);
  console.log(`  Compile:  ${compileSuccess ? '✓' : '✗'}`);
  console.log(`  Lint:     ${lintSuccess ? '✓' : '✗'}`);
  console.log(`  Docs:     ${documentationAdded ? '✓' : '—'}`);

  return {
    success,
    moduleName,
    packageDir,
    exampleFiles: createdFiles,
    compileSuccess,
    compileOutput: compileResult.output,
    lintSuccess,
    lintOutput,
    documentationAdded,
    durationMs,
  } satisfies WriteExamplesResult;
}
