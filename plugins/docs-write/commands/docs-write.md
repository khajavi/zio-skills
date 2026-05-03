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

## Phase 1: Topic + Doc Type Detection

**Goal**: Understand what to document and which documentation type to generate

**Actions**:
1. Receive `$ARGUMENTS` as the raw topic (type name, module name, or free-text description)
2. If `$ARGUMENTS` is empty, ask the user to provide a topic using `AskUserQuestion`
3. Use `AskUserQuestion` to ask which documentation type they want to write:
   - Data type reference — full API documentation for a single Scala data type
   - Module reference — reference documentation for a module with multiple related types
   - How-to guide — goal-oriented guide for accomplishing a specific task
   - Tutorial — learning-oriented guide for newcomers to a concept
4. Confirm the chosen type and topic before proceeding

---

## Phase 2: Source Research

**Goal**: Understand the codebase deeply before writing documentation

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

**Actions**:
1. Invoke the `docs-reviewer` agent via the Agent tool, passing:
   - The generated documentation file path
   - The documentation type (data type reference, module reference, how-to guide, or tutorial)
2. Based on the agent's report, ask the user whether to:
   - Fix issues now
   - Fix later
   - Proceed as-is

---

## Phase 5: Summary

**Goal**: Document what was accomplished and suggest next steps

**Actions**:
1. Report to user:
   - Documentation type generated
   - File path created
   - Key decisions made during review and revision
   - Any remaining issues (if user chose "Fix later" or "Proceed as-is")
2. Suggest next steps:
   - Run `sbt docs/mdoc` to verify full documentation compiles
   - Open a pull request with the new documentation
   - Link to related documentation pages
   - Mention any follow-up documentation work (e.g., expand examples, add related types)

---
