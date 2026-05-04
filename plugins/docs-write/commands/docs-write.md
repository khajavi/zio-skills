---
description: Generate documentation for existing ZIO library code — reference pages, how-to guides, or tutorials
argument-hint: "<TypeName | module-name | topic description>"
---

# Documentation Writing Workflow

You are helping a developer write documentation for already-written code. Follow a systematic 5-phase approach: understand what to document, research the codebase, generate documentation using the appropriate skill, review for quality, then summarize.

## Core Principles

- **Ask clarifying questions**: Identify what type of documentation is needed before proceeding
- **Research thoroughly**: Understand the public API, test patterns, and existing gaps before writing
- **Delegate skillfully**: Route to the appropriate documentation skill (data type ref, module ref, how-to guide, or tutorial)
- **Review rigorously**: Check structure, then content quality, then style compliance
- **Use specialized agents**: Leverage `docs-researcher` for codebase exploration and `docs-reviewer` for quality checks

---

## Phase 1: Topic + Doc Type Detection + Phase Selection

**Goal**: Understand what to document, which documentation type to generate, and which workflow phases to run

**Actions**:
1. Receive `$ARGUMENTS` as the raw topic (type name, module name, or free-text description)
2. If `$ARGUMENTS` is empty, ask the user to provide a topic using `AskUserQuestion`
3. Use `AskUserQuestion` to ask which documentation type they want to write:
   - Data type reference — full API documentation for a single Scala data type
   - Module reference — reference documentation for a module with multiple related types
   - How-to guide — goal-oriented guide for accomplishing a specific task
   - Tutorial — learning-oriented guide for newcomers to a concept
4. Confirm the chosen type and topic before proceeding
5. **Phase Selection**: Ask the user which of the remaining phases to run using `AskUserQuestion` with `multiSelect: true`:
   - Phase 2: Source Research
   - Phase 3: Documentation Generation
   - Phase 4: Documentation Review 
   - Phase 5: Summary
   
   All four phases are pre-selected by default. Store the user's selection for use in subsequent phases.

---

## Phase 2: Source Research

**Goal**: Understand the codebase deeply before writing documentation

**Guard**: If Phase 2 was not selected by the user in Phase 1, skip this phase entirely and proceed to Phase 3.

**Actions**:
1. Determine agent count based on scope:
   - **1 agent** for data type references (single type = single focus)
   - **2 parallel agents** for module references or complex how-to/tutorial topics (split into different focus areas)
2. Launch `docs-researcher` agent(s) which will:
   - Invoke the `/docs-research` skill to analyze source code, tests, examples, and GitHub history
   - Return structured findings including:
     - Core and supporting types with source file paths
     - Public API surface organized by category
     - Test-driven usage patterns and edge cases
     - Existing documentation coverage and gaps
     - List of 5-10 critical files to read
3. After agents return, read all identified critical files to build deep understanding
4. Present consolidated findings to user before proceeding

---

## Phase 3: Documentation Generation

**Goal**: Generate documentation using the appropriate skill

**Guard**: 
- If Phase 3 was not selected by the user in Phase 1, skip this phase and proceed to Phase 4.
- If Phase 3 was selected **and** Phase 2 was skipped, ask the user: "Phase 2 (Research) was skipped. Please provide any research notes or context to use during generation, or press enter to proceed with the topic name only." (Optional input — generation can proceed without it.)

**Actions**:
1. Invoke the chosen skill via the `Skill` tool:
   - Data type reference → `/docs-data-type-ref <topic>`
   - Module reference → `/docs-module-ref <topic>`
   - How-to guide → `/docs-how-to-guide <topic>`
   - Tutorial → `/docs-tutorial <topic>`
2. Let the skill handle the complete workflow (structure, mdoc compilation, example creation, sidebars integration)
3. Do **not** duplicate any of the skill's internal steps
4. When the skill completes, capture the file path of the generated documentation

---

## Phase 4: Documentation Review

**Goal**: Ensure documentation is technically accurate, structurally sound, and stylistically compliant

**Guard**:
- If Phase 4 was not selected by the user in Phase 1, skip this phase and proceed to Phase 5.
- If Phase 4 was selected **and** Phase 3 was skipped, ask the user: "Phase 3 (Generation) was skipped. Please provide the file path of the documentation to review." (Required input — review cannot proceed without a file path. Store this path for the review step.)

**Action**:
Invoke the `docs-reviewer` agent via the Agent tool with these explicit instructions:
1. First, ask the user which of the 4 review steps to run using `AskUserQuestion` with `multiSelect: true`:
   - Step 1: Critique Review Loop
   - Step 2: Structural Completeness
   - Step 3: Writing Style Check
   - Step 4: Code Style Check
2. Then execute the selected steps on the documentation file
3. Pass the generated documentation file path and doc type to the agent

All 4 steps are pre-selected by default.

---

## Phase 5: Summary

**Goal**: Document what was accomplished and suggest next steps

**Guard**: If Phase 5 was not selected by the user in Phase 1, end the workflow here.

**Actions** (when Phase 5 runs):
1. Adapt the report based on which phases executed:
   - **If all phases ran** (full workflow):
     - Documentation type generated
     - File path created
     - Key decisions made during review and revision
     - Any remaining issues (if user chose "Fix later" or "Proceed as-is")
   - **If only some phases ran** (partial workflow):
     - Clearly state which phases were executed (e.g., "Phases 2, 4, and 5 executed; Phases 1 and 3 were skipped")
     - Report outcomes from each executed phase
     - Note any limitations due to skipped phases
2. Suggest next steps (adapted to the workflow):
   - If Phase 3 or 4 ran: Run `sbt docs/mdoc` to verify documentation compiles
   - If Phase 3 ran: Suggest opening a pull request with the new documentation
   - Link to related documentation pages
   - Mention any follow-up documentation work

---
