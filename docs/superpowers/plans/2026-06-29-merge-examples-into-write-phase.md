# Merge Examples Into Write Phase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Phase 2.5 (Examples) as a standalone phase in `write-tutorial.ts` and inline it as a sub-step at the end of Phase 2 (Write), so the two phases share one `phasesCompleted.push('write')` call and the phase count stays at 7.

**Architecture:** The `runExamplesPhase` function already accepts an optional `session` parameter to reuse the writer session — no changes needed in `phases/examples.ts`. All changes are in `write-tutorial.ts`: move the examples call inside Phase 2's `else` block, remove the Phase 2.5 block, drop the `examplesPayload ? 1 : 0` bump from `expectedPhases`, and update the `skipPhases` JSDoc.

**Tech Stack:** TypeScript, Flue runtime (`@flue/runtime`), Node.js

## Global Constraints

- Branch: `separate-agent-for-research` — commit to this branch
- Never touch `writer-assistant/workflows/phases/examples.ts` — its API is stable
- Keep `'examples'` in `skipPhases` for backward compatibility — it now controls an inner sub-step of Phase 2
- Push to `khajavi` remote (not `origin`)
- TypeScript must compile clean: `cd writer-assistant && npm run build`

---

### Task 1: Merge Phase 2.5 into Phase 2 in `write-tutorial.ts`

**Files:**
- Modify: `writer-assistant/workflows/write-tutorial.ts`

**Interfaces:**
- Consumes: `runExamplesPhase(harness, options)` from `./phases/examples.js` — signature unchanged
- Produces: `examplesResult` set inside Phase 2 `else` block; returned in output object as before

- [ ] **Step 1: Read the current file to understand exact line numbers**

Read `writer-assistant/workflows/write-tutorial.ts` and identify:
- Line where `let examplesResult` is declared (currently ~line 189)
- Start/end lines of the Phase 2.5 block (currently ~lines 188–212)
- Line where `expectedPhases` is set (currently ~line 459)
- The `skipPhases` JSDoc comment block (lines ~68–76)

- [ ] **Step 2: Hoist `examplesResult` declaration to Phase 2 scope**

In `writer-assistant/workflows/write-tutorial.ts`, the current Phase 2.5 block starts with:

```typescript
    // Phase 2.5: Examples (optional — only when `examples` payload provided)
    let examplesResult: Awaited<ReturnType<typeof runExamplesPhase>> | null = null;
    if (examplesPayload) {
```

Move the `let examplesResult` declaration to just before Phase 2's `if/else` block (where `let phase2StartTime = Date.now()` currently is), and remove Phase 2.5 entirely.

The full new Phase 2 block (replace lines from `// Phase 2: Write Documentation` through the end of the Phase 2.5 block) should be:

```typescript
    // Phase 2: Write Documentation (+ optional Examples sub-step)
    let phase2StartTime = Date.now();
    let examplesResult: Awaited<ReturnType<typeof runExamplesPhase>> | null = null;
    if (skipPhases.includes('write')) {
      console.log('\n[Phase 2] ⏭ Write skipped');
      phasesCompleted.push('write');
    } else {
      console.log('\n[Phase 2] Writing: Generating tutorial...');
      phase2StartTime = Date.now();
      const writePrompt = `**Research Findings (from research phase):**
${researchResult}

---

**Phase 2: Write Tutorial Documentation**

Based on the research findings above, now write a comprehensive tutorial for learning about ${topic}.

**Requirements:**
- Output file path: ${resolvedOutputPath}
- File must be in docs/guides/ directory
- File must have proper frontmatter with id, title, description, and keywords
  - description: one sentence, ≤150 characters, describes what the tutorial teaches
  - keywords: 3-7 meaningful phrases (1-3 words each), e.g. feature names, patterns, learning outcomes
- Follow the exact 7-section structure provided in the docs-tutorial skill
- Every code example MUST use mdoc syntax
- No blank lines between consecutive code blocks
- Include explanatory paragraphs between code block groups
- Tutorial must follow a strict linear path (no branching, no "alternatively")

**Section structure (in order):**
1. Introduction (with Learning Objectives and section outline)
2. Background / Big Picture (optional, no code)
3. Concept sections (3-6 sections, one concept each)
4. Putting It Together (complete runnable example)
5. Running the Examples (### per example: narrative + mdoc:embed source in <details> + "Observe X:" + bash run command)
6. What You've Learned (recap of objectives)
7. Where to Go Next (links to how-to guides and reference pages)

**Writing guidance:**
- Use the docs-tutorial skill for detailed conventions
- Use warm, welcoming tone: "Welcome", "Let's", "notice that"
- Use present tense: "we learn", "we see", "we observe"
- Address learner directly: "you now understand", "you can now do"
- Line-by-line annotation after each code block
- Show intermediate output when meaningful
- Every section must have code
- No pseudo-code or fake error messages
- Use \`mdoc\` for output-producing examples, \`mdoc:compile-only\` for complete final example

Write the complete markdown file and save it to the specified output path.`;

      await session!.prompt(writePrompt);
      console.log('[Phase 2] ✓ Tutorial written');

      // Examples sub-step (inline — formerly Phase 2.5)
      if (examplesPayload) {
        if (skipPhases.includes('examples')) {
          console.log('\n[Phase 2 / Examples] ⏭ Examples skipped');
        } else {
          console.log('\n[Phase 2 / Examples] Generating companion Scala examples...');
          examplesResult = await runExamplesPhase(harness, {
            projectRoot,
            moduleName: examplesPayload.moduleName,
            packageName: examplesPayload.packageName,
            parentModule: examplesPayload.parentModule,
            topic,
            docType: 'tutorial',
            outputDocPath: resolvedOutputPath,
            session: session!,
          });
          console.log(
            `[Phase 2 / Examples] ${examplesResult.success ? '✓' : '⚠'} Examples complete ` +
              `(${examplesResult.exampleFiles.length} files, compile: ${examplesResult.compileSuccess ? '✓' : '✗'}, run: ${examplesResult.runSuccess ? '✓' : '✗'})`
          );
        }
      }

      phasesCompleted.push('write');
    }
```

- [ ] **Step 3: Fix `expectedPhases` count**

Find the line (currently ~459):
```typescript
    const expectedPhases = 7 + (examplesPayload ? 1 : 0);
```

Replace with:
```typescript
    const expectedPhases = 7;
```

- [ ] **Step 4: Update `skipPhases` JSDoc to reflect new semantics**

Find the JSDoc comment inside the input destructuring (~lines 68–76):
```typescript
    /**
     * Phase names to skip. Skipped phases are counted as completed without running.
     * Valid values: "research" | "write" | "examples" | "verify" | "integrate" | "review" | "style" | "verifyBuild"
     * Example: ["research","write","verify","integrate","review","style"] to run only the build phase.
     */
```

Replace with:
```typescript
    /**
     * Phase names to skip. Skipped phases are counted as completed without running.
     * Valid values: "research" | "write" | "verify" | "integrate" | "review" | "style" | "verifyBuild"
     * Note: "examples" skips the Examples sub-step inside Phase 2 (Write). Skipping "write" also skips examples.
     * Example: ["research","write","verify","integrate","review","style"] to run only the build phase.
     */
```

- [ ] **Step 5: Verify TypeScript compiles clean**

```bash
cd /home/milad/sources/zio-skills/writer-assistant && npm run build
```

Expected: zero TypeScript errors. If errors appear, read the error lines and fix the specific lines they reference.

- [ ] **Step 6: Commit**

```bash
git add writer-assistant/workflows/write-tutorial.ts
git commit -m "refactor(write-tutorial): merge examples phase into write phase

Examples (formerly Phase 2.5) now runs as an inline sub-step at the
end of Phase 2 (Write). Phase count stays at 7. The 'examples' skip
key is preserved for backward compatibility and controls the sub-step."
```
