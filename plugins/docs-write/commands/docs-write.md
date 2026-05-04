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

## Documentation Types
- **Data Type Reference** — full API documentation for a single Scala data type
- **Module Reference** — reference documentation for a module with multiple related types
- **How To Guide** — goal-oriented guide for accomplishing a specific task
- **Tutorial** — learning-oriented guide for newcomers to a concept

## Workflow Phases
- Phase 1: Source Research
- Phase 2: Documentation Generation
- Phase 3: Documentation Review
- Phase 4: Summary

---

## Phase Zero: Topic + Doc Type Detection + Phase Selection

**Goal**: Understand what to document, which documentation type to generate, and which workflow phases to run

**Actions**:
1. Receive `$ARGUMENTS` as the raw topic (type name, module name, or free-text description)
2. If `$ARGUMENTS` is empty, ask the user to provide a topic using `AskUserQuestion`
3. Use `AskUserQuestion` to ask which "Documentation Type" they want to write.
4. Confirm the chosen type and topic before proceeding
5. **Phase Selection**: Ask the user which of the "Workflow Phases" to run using `AskUserQuestion` with `multiSelect: true`. All four phases are pre-selected by default. Store the user's selection for use in subsequent phases.

---

## Phase 1: Source Research

**Goal**: Understand the codebase deeply before writing documentation

**Guard**: If Phase 1 was not selected by the user in Phase 0, skip this phase entirely and proceed to Phase 2.

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

## Phase 2: Documentation Generation

**Goal**: Generate documentation using the appropriate skill

**Guard**:
- If Phase 2 was not selected by the user in Phase 0, skip this phase and proceed to Phase 3.
- If Phase 2 was selected **and** Phase 1 was skipped, ask the user: "Phase 1 (Research) was skipped. Please provide any research notes or context to use during generation, or press enter to proceed with the topic name only." (Optional input — generation can proceed without it.)

**Actions**:
1. Invoke the chosen skill via the `Skill` tool:
    - Data Type Reference → `/docs-data-type-ref <DataTypeName>`
    - Module Reference → `/docs-module-ref <module-name>`
    - How-to Guide → `/docs-how-to-guide <topic>`
    - Tutorial → `/docs-tutorial <topic>`
2. Let the skill handle the complete workflow (structure, mdoc compilation, example creation, sidebars integration)
3. When the skill completes, capture the file path of the generated documentation

---

## Phase 3: Documentation Review

**Goal**: Ensure documentation is technically accurate, structurally sound, and stylistically compliant

**Guard**:
- If Phase 3 was not selected by the user in Phase 0, skip this phase and proceed to Phase 4.
- If Phase 3 was selected **and** Phase 2 was skipped, ask the user: "Phase 2 (Generation) was skipped. Please provide the file path of the documentation to review." (Required input — review cannot proceed without a file path. Store this path for the review step.)

**Action**:
Invoke the `docs-reviewer` agent via the Agent tool, passing:
- The generated documentation file path
- The documentation type (data type reference, module reference, how-to guide, or tutorial)

---

## Phase 4: Summary

**Goal**: Document what was accomplished and suggest next steps

**Guard**: If Phase 4 was not selected by the user in Phase 0, end the workflow here.

**Actions**:
1. Adapt the report based on which phases executed:
    - **If all phases ran** (full workflow):
        - Documentation type generated
        - File path created
        - Key decisions made during review and revision
        - Any remaining issues (if user chose "Fix later" or "Proceed as-is")
    - **If only some phases ran** (partial workflow):
        - Clearly state which phases were executed (e.g., "Phases 1, 3, and 4 executed; Phases 0 and 2 were skipped")
        - Report outcomes from each executed phase
        - Note any limitations due to skipped phases
2. Suggest next steps (adapted to the workflow):
    - If Phase 2 or 3 ran: Run `sbt docs/mdoc` to verify documentation compiles
    - Link to related documentation pages

---
