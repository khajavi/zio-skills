import { createRunMdoc } from '../../tools/run_mdoc.js';
import { runBuild } from '../../lib/build-runner.js';

function buildStructureCheck(docType: string): string {
  switch (docType) {
    case 'tutorial':
      return `1. **Verify structure compliance**
   - Check that all 7 sections are present and in correct order
   - Verify section headings use numbered format (## 1. Topic, ## 2. Topic, etc.)
   - Ensure Introduction has Learning Objectives
   - Confirm "What You've Learned" mirrors Learning Objectives
   - Check that "Where to Go Next" links to how-to guides`;

    case 'how-to-guide':
      return `1. **Verify structure compliance**
   - Check that all required sections are present: Introduction, The Problem, Prerequisites, The Core Model, step-by-step sections, Putting It Together, Running the Examples
   - Confirm The Problem section includes: concrete problem statement + why it matters + a "before" code example
   - Verify each step-by-step section covers exactly one concept with at least one code example
   - Confirm "Putting It Together" is a complete, copy-paste runnable example
   - Check that no section is pure prose — every section must have at least one code block`;

    case 'data-type-ref':
    case 'module-ref':
      return `1. **Check method coverage**
   - Extract the list of all public methods from the source
   - Verify that each method is documented with an explanation
   - Note total method count and coverage percentage`;

    default:
      return `1. **Verify structure compliance**
   - Check that all required sections are present and in correct order`;
  }
}

function buildStyleCheck(docType: string): string {
  switch (docType) {
    case 'tutorial':
      return `3. **Check line-by-line annotations**
   - Verify every code block is followed by bullet-point line-by-line explanation
   - Check that intermediate results are shown after major steps
   - Ensure no blank lines between consecutive code blocks`;

    case 'how-to-guide':
      return `3. **Check how-to guide style**
   - Verify prose is direct and imperative (not warm/tutorial-style)
   - Check that there is no conceptual preamble before The Problem section
   - Ensure intermediate results are shown after major steps
   - Verify no blank lines between consecutive code blocks
   - Confirm the output file is under docs/guides/ (not docs/reference/ or docs/tutorials/)`;

    case 'data-type-ref':
      return `3. **Check documentation compliance**
   - Verify no blank lines between consecutive code blocks
   - Check that each section follows the required structure
   - Ensure method signatures are in plain scala blocks (no mdoc)
   - Verify examples are in mdoc:reset blocks`;

    case 'module-ref':
      return `3. **Check documentation compliance**
   - Verify no blank lines between consecutive code blocks
   - Check "How They Work Together" section has ASCII diagram
   - Ensure method signatures are in plain scala blocks (no mdoc)
   - Verify examples are in mdoc:reset blocks`;

    default:
      return `3. **Check documentation compliance**
   - Verify no blank lines between consecutive code blocks`;
  }
}

function buildChecklistStep(docType: string): string {
  switch (docType) {
    case 'tutorial':
      return `\n4. **Review CHECKLIST.md**
   - Use the checklist in the docs-tutorial skill to self-verify all 38 items
   - Focus on Content Quality, Technical Accuracy, and Style sections`;

    case 'how-to-guide':
      return `\n4. **Review CHECKLIST.md**
   - Use the checklist in the docs-how-to-guide skill to self-verify all items
   - Focus on Content Quality, Technical Accuracy, and Companion Examples sections
   - Fix any violations found before reporting complete`;

    default:
      return '';
  }
}

function buildReport(docType: string): string {
  switch (docType) {
    case 'tutorial':
      return `Report:
- Structure compliance status
- Final mdoc error count (should be 0)
- Any fixes applied
- CHECKLIST status`;

    case 'how-to-guide':
      return `Report:
- Structure compliance status
- Final mdoc error count (should be 0)
- CHECKLIST status
- Any fixes applied`;

    case 'data-type-ref':
    case 'module-ref':
      return `Report:
- Method coverage percentage
- Final mdoc error count (should be 0)
- Any fixes applied
- Status: success/partial/failed`;

    default:
      return `Report:
- Final mdoc error count (should be 0)
- Any fixes applied`;
  }
}

function docTypeName(docType: string): string {
  switch (docType) {
    case 'tutorial': return 'Tutorial';
    case 'how-to-guide': return 'How-To Guide';
    case 'data-type-ref': return 'Documentation';
    case 'module-ref': return 'Documentation';
    default: return 'Documentation';
  }
}

export async function verifyBuild(docsDir: string): Promise<{ success: boolean; buildSystem: string; durationMs: number; output: string }> {
  const result = await runBuild(docsDir);
  return { success: result.success, buildSystem: result.buildSystem, durationMs: result.durationMs, output: result.output };
}

export async function runVerifyPhase(
  session: any,
  options: {
    projectRoot: string;
    changedFiles: string[];
    topic: string;
    resolvedOutputPath: string;
    docType: 'tutorial' | 'how-to-guide' | 'data-type-ref' | 'module-ref';
  }
): Promise<void> {
  const { projectRoot, changedFiles, topic, resolvedOutputPath, docType } = options;

  const changedFilesStr =
    changedFiles.length > 0
      ? `\n\n**Files to compile with mdoc** (detected as new/changed):\n${changedFiles.map((f) => `- ${f}`).join('\n')}`
      : '\n\n**Note:** No additional markdown files were changed. Compile the main output file only.';

  const verifyPrompt = `**Phase 3: Verify ${docTypeName(docType)}**

Verify the ${docType} you just wrote for ${topic} at ${resolvedOutputPath}

**Verification steps:**

${buildStructureCheck(docType)}

2. **Compile with run_mdoc**${changedFilesStr}
   - **CRITICAL: Use ONLY the run_mdoc tool for compilation** (do not use bash/sbt directly)
   - The run_mdoc tool provides structured error parsing
   - Call run_mdoc with paths: ${JSON.stringify(changedFiles)}
   - If run_mdoc returns errors, fix the markdown and call it again
   - Iterate until all code blocks compile with zero errors

${buildStyleCheck(docType)}
${buildChecklistStep(docType)}

${buildReport(docType)}`;

  await session.prompt(verifyPrompt, {
    tools: [createRunMdoc(projectRoot)],
  });
}
