---
name: docs-research
description: Shared research procedure for documentation skills. Find source files, tests, examples, patterns, and GitHub history when researching a topic. Used by docs-how-to-guide, docs-tutorial, and docs-data-type-ref.
allowed-tools: Read, Glob, Grep, Bash(gh:*), Bash(sbt:*)
---

# Source Code Research for Documentation

Use this procedure when researching a topic to understand the complete landscape of types, methods, patterns, and integrations before writing documentation.

## Core Mission

Provide documentation authors with comprehensive understanding of:
- Complete public API surface (all methods, signatures, variants)
- Real-world usage patterns and composition examples
- Design decisions and architectural relationships
- Dependencies, integrations, and supported use cases
- Gaps, edge cases, and performance characteristics

## Analysis Approach

### 1. Discovery Phase

**Locate core source files:**
- Use Glob and Grep to find source files for the topic:
  ```
  Glob: **/src/main/scala*/**/<TypeName>.scala
  Grep: "class <TypeName>" or "trait <TypeName>" or "object <TypeName>"
  ```
- For modules: identify all core types and their source file locations

**Identify scope and boundaries:**
- Read the full source file(s) — understand every public method, type parameter, companion object, and factory method
- Map what is public API vs. internal implementation
- Note accessibility modifiers, deprecated methods, and alternative names

### 2. Code Flow & Usage Tracing

**Understand how the API is used:**
1. **Search test suites** (`*/src/test/scala/`) for idiomatic usage patterns
   - Look for construction patterns (how objects are created)
   - Trace method call sequences and data transformations
   - Identify edge cases and boundary conditions (empty values, single elements, large inputs)
   - Document error conditions and exception handling

2. **Find real-world examples**
   - Glob `**/examples/**/*.scala` for companion examples
   - Search integration tests combining multiple types
   - Look for cross-module usages via Grep to reveal composition patterns

3. **Trace type dependencies**
   - Grep imports in test files to reveal the full dependency graph
   - For each public method returning a complex type, trace that type's documentation
   - Identify implicit instances and type class derivation patterns

### 3. Architecture & Design Analysis

**Map abstraction layers and patterns:**
- Identify layers: constructors → transformations → queries → finalization
- Document common patterns: builders, factories, functional chains, state management
- Note which operations are composable vs. terminal
- Understand type relationships: inheritance, composition, sealed traits vs. open hierarchies

**Design rationale:**
- Search GitHub history for design decisions, API evolution, known tradeoffs
- Identify any documented anti-patterns or common misconceptions

### 4. Documentation Landscape

**Understand existing coverage:**
- Check `docs/reference/` and `docs/` for existing documentation
- Identify what is already documented vs. gaps to address
- Note examples or patterns already documented elsewhere

**Identify documentation gaps:**
- Methods lacking test coverage
- Performance characteristics not captured
- Edge cases not exercised in tests
- Composition examples not yet documented

## Research Workflow

### Step 1: Read Core Source Files
For each core type, read the full source file to understand:
- All public methods and their signatures
- Type parameters, variance, constraints
- Companion object and factory methods
- Javadoc/scaladoc comments (design intent)

### Step 2: Read Test Files
Search and read test suites to understand:
- Construction patterns and common usages
- Method chaining and composition examples
- Edge cases: empty inputs, single elements, large data
- Error handling and exception cases
- Integration with other types

### Step 3: Find Supporting Types
Identify every type that core methods depend on:
1. Grep imports in test files for the full dependency graph
2. For each supporting type, read enough source and documentation to explain it in context
3. Trace return types through multiple layers if needed

### Step 4: Search for Real-World Patterns
1. **Examples directory**: `Glob` for `**/examples/**/*.scala`
2. **Integration tests**: Look for tests combining multiple types from this module
3. **Cross-module usage**: `Grep` across other modules to find how core types integrate
4. **Documentation patterns**: Check if similar types have documented examples you can mirror

### Step 5: GitHub History Research
Use GitHub CLI to surface design rationale and common questions:

```bash
gh issue list  --repo <owner>/<repo> --state all --search "<topic>" --limit 30
gh pr    list  --repo <owner>/<repo> --state all --search "<topic>" --limit 30
gh search code --repo <owner>/<repo> "<topic>" --limit 20
```

For high-value issues/PRs, read full discussion: `gh issue view <n> --comments`

## Output Structure

Provide findings organized as:

- **Core types** with fully qualified names and source file paths (with line numbers)
- **Public API** organized by category (constructors, transformations, queries, etc.)
- **Usage patterns** from tests: construction, composition, error handling
- **Dependencies**: which types use which other types, and why
- **Real-world examples**: concrete composition patterns from tests/examples
- **Documentation gaps**: methods with no test coverage, undocumented behavior
- **Architecture insights**: design patterns, abstraction layers, design decisions
- **Critical files** (5-10 most important files) prioritized by relevance

---

## Design Rule

This sub-skill targets comprehensive research for documentation. Focus on understanding what documentation authors need, not on writing documentation itself.
