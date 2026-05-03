# Documentation Writing Plugin

A guided, structured workflow for writing documentation for existing ZIO library code. Instead of writing documentation from scratch, this plugin helps you understand what to document, research the codebase, generate appropriate documentation, and ensure quality through multiple layers of review.

## Philosophy

Writing good documentation requires more than writing skills. You need to:
- **Understand the code** before documenting it
- **Choose the right format** (reference, how-to guide, or tutorial)
- **Research the codebase** to understand API surface and usage patterns
- **Generate documentation** using proven templates and structures
- **Review rigorously** for structural soundness, technical accuracy, and style compliance

This plugin embeds these practices into a structured workflow that runs automatically when you use the `/docs-write` command.

## Command: `/docs-write`

Launches a guided 5-phase documentation writing workflow.

**Usage:**
```bash
/docs-write Chunk
/docs-write http-model
/docs-write "handling errors with ZIO"
/docs-write "introduction to schema"
```

Or simply:
```bash
/docs-write
```

The plugin will guide you through the entire process interactively.

## The 5-Phase Workflow

### Phase 1: Topic + Doc Type Detection

**Goal**: Understand what to document and which documentation type to generate

**What happens:**
- You provide a topic (type name, module name, or concept description)
- The plugin asks which documentation type you want to write:
  - **Data type reference** — full API documentation for a single Scala data type
  - **Module reference** — reference documentation for a module with multiple related types
  - **How-to guide** — goal-oriented guide for accomplishing a specific task
  - **Tutorial** — learning-oriented guide for newcomers to a concept

### Phase 2: Source Research

**Goal**: Understand the codebase deeply before writing

**What happens:**
- Launches 1-2 `docs-researcher` agents (1 for single types, 2 parallel for modules/complex topics)
- Each agent explores:
  - Full public API surface (all public methods, signatures)
  - Test files to understand intended usage and edge cases
  - Related types and integrations
  - Documentation gaps (methods with no test coverage)
  - GitHub history for design decision context
- Agents identify 5-10 critical source files to read
- You review findings before proceeding

**Example output:**
```
Found Chunk type in zio/Chunk.scala:45

Public API:
- apply/empty (constructors)
- map, flatMap, filter (transformations)
- get, head, tail (accessors)
- ++, concat (combining)
- exists, forall, find (querying)

Test patterns:
- Construction from arrays, lists, varargs
- Transformation chains
- Edge cases: empty chunks, single-element chunks

Gaps:
- Performance characteristics not documented
- Iterator interface undocumented
```

### Phase 3: Documentation Generation

**Goal**: Generate documentation using the appropriate skill

**What happens:**
- Routes to the appropriate documentation skill:
  - `docs-data-type-ref` for data type references
  - `docs-module-ref` for module references
  - `docs-how-to-guide` for how-to guides
  - `docs-tutorial` for tutorials
- Each skill handles the full workflow:
  - Generating the documentation structure
  - Writing code examples
  - Compiling with mdoc
  - Integrating into sidebars and indices
- The plugin does not duplicate any skill's internal steps

### Phase 4: Documentation Review

**Goal**: Ensure documentation is technically accurate, structurally complete, and stylistically polished

**What happens** (three sequential review steps):

**Step 1 — Content Quality (Maker-Critic Loop)**
- Invokes `docs-critique` skill
- `docs-critic` agent reviews:
  - Technical accuracy (does code match implementation?)
  - Completeness (are all aspects covered?)
  - Consistency (does it match other documentation?)
- Makes generate fixes and iterates up to 3 rounds
- Terminates when documentation is APPROVED

**Step 2 — Structural Completeness**
- For **reference pages**: verifies every public method has a corresponding subsection
- For **guides and tutorials**: verifies all required sections are present
- Checks that sidebars.js and index.md have been updated
- Reports any structural gaps

**Step 3 — Style & mdoc Compliance**
- Checks against 25 writing style rules
- Verifies mdoc modifiers are correct for each code block
- Ensures code examples are properly formatted and compile
- Reports only high-confidence issues (≥80)

### Phase 5: Summary

**Goal**: Document what was accomplished and suggest next steps

**What happens:**
- Reports:
  - Documentation type generated
  - File path created
  - Key decisions made
  - Any remaining issues (if you chose "fix later")
- Suggests next steps:
  - Run `sbt docs/mdoc` to verify documentation compiles
  - Open a pull request
  - Link to related documentation pages

## Agents

### `docs-researcher`

**Purpose**: Deeply analyzes source code to extract everything needed for documentation

**Focus areas:**
- Public API surface (methods, signatures, categories)
- Test-driven usage patterns
- Edge cases and design decisions
- Related types and integrations
- Documentation gaps

**When triggered:**
- Automatically in Phase 2
- Can be invoked manually to understand a codebase feature

**Output:**
- Fully qualified type/module name and source paths
- Complete public API organized by category
- Common usage patterns from tests
- Documentation gaps identified
- List of 5-10 critical files to read

### `docs-reviewer`

**Purpose**: Reviews documentation for quality, completeness, and compliance

**Focus areas:**
- Writing style (25 rules from `docs-writing-style`)
- mdoc modifier correctness (per `docs-mdoc-conventions` rules)
- Structural completeness (required sections present)
- Method coverage (for reference pages)
- Code example quality

**When triggered:**
- Automatically in Phase 4 Step 3
- Can be invoked manually to review existing documentation

**Output:**
- High-confidence issues only (≥80 confidence)
- Grouped by severity (Critical vs Important)
- Specific file:line references and fix suggestions
- Clear explanation of which rule/requirement is violated

## Usage Patterns

### Full workflow (recommended for new documentation):

```bash
/docs-write Chunk
```

Let the workflow guide you through all 5 phases.

### Manual agent invocation:

**Explore a type:**
```
"Launch docs-researcher to understand how Chunk is used in tests"
```

**Review existing documentation:**
```
"Launch docs-reviewer to check my documentation against style rules"
```

## Best Practices

1. **Use the full workflow for all new documentation** — The 5 phases ensure thorough understanding
2. **Answer researcher questions thoughtfully** — Phase 2 findings inform how you write
3. **Let critique loop iterate** — Phase 4 Step 1 catches issues before structural review
4. **Choose "Fix now" for high-confidence issues** — Don't defer critical fixes
5. **Read the suggested files** — Phase 2 identifies key files—understanding them deeply improves documentation

## When to Use This Plugin

**Use for:**
- New reference pages for data types or modules
- How-to guides for common tasks
- Tutorials for newcomers to a feature
- Complete documentation projects where you want quality assurance

**Don't use for:**
- Quick edits to existing documentation (edit directly)
- Documentation for private/internal types
- Single-sentence fixes

## Requirements

- Both `documentation` and `docs-write` plugins from `zio-skills` must be installed
- Access to the ZIO library source code
- `sbt` available for `mdoc` compilation (optional, but recommended)

## Example Session

```
You: /docs-write Ref

Plugin: What type of documentation would you like to write?
  ● Data type reference
  ● Module reference
  ● How-to guide
  ● Tutorial

You: Data type reference

Plugin: Launching docs-researcher to analyze Ref...
[docs-researcher explores source, tests, and related code]

Plugin: Found Ref in zio/Ref.scala
Public API: 40 public methods across 8 categories
Common patterns: concurrent updates, state transformation
Documentation gaps: thread-safety guarantees not documented

Proceeding to docs-data-type-ref skill...
[docs-data-type-ref generates reference documentation]

Plugin: Generated docs/reference/ref.md
Running critique loop...
[docs-critic reviews, maker fixes]

Plugin: Critique passed!
Checking structural completeness...
[docs-reviewer checks all required sections]

All sections present. Checking style...
[docs-reviewer checks writing style and mdoc]

Documentation complete! 
File: docs/reference/ref.md
Next steps: Run `sbt docs/mdoc` to verify compilation
```

## Architecture

The plugin uses a thin-router pattern:
- **Commands** (`docs-write.md`) orchestrate the 5-phase workflow
- **Agents** (`docs-researcher`, `docs-reviewer`) provide specialized analysis and review
- **Skills** (`docs-data-type-ref`, `docs-module-ref`, `docs-how-to-guide`, `docs-tutorial`) handle documentation generation
- **Utility skills** (`docs-critique`, `docs-data-type-list-members`, `docs-report-method-coverage`, etc.) provide reusable building blocks

No documentation generation code is duplicated; the plugin is purely an orchestrator.

## Workflow Diagram

```
/docs-write <topic>
      │
      ▼
┌──────────────────────────────┐
│  Phase 1: Topic + Doc Type   │
│  AskUserQuestion:            │
│  ● Data type reference       │
│  ● Module reference          │
│  ● How-to guide              │
│  ● Tutorial                  │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐   ┌─────────────────────────┐
│  Phase 2: Source Research    │──►│  docs-researcher agent   │
│  • Full public API surface   │   │  (1 agent for types;    │
│  • Test-driven usage patterns│   │   2 parallel for modules│
│  • Existing doc gaps         │   │   or complex topics)    │
│  • 5–10 critical source files│   └─────────────────────────┘
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐   ┌──────────────────────────┐
│  Phase 3: Doc Generation     │──►│  docs-data-type-ref  OR  │
│  Invoke the chosen skill     │   │  docs-module-ref     OR  │
│  (handles full workflow:     │   │  docs-how-to-guide   OR  │
│  structure, mdoc, examples,  │   │  docs-tutorial           │
│  sidebars integration)       │   └──────────────────────────┘
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  Phase 4: Review             │
│                              │
│  Step 1 ── Critique loop     │◄── docs-critique skill
│  • docs-critic reviews       │    (maker-critic, up to 3
│  • Maker applies fixes       │     rounds, APPROVED or
│  • Iterates until APPROVED   │     remaining issues)
│            │                 │
│  Step 2 ── Structural check  │◄── docs-reviewer agent
│  • Method coverage           │    (docs-data-type-list-members
│  • Required sections present │     + docs-report-method-coverage
│  • Integration checklist     │     for reference pages)
│            │                 │
│  Step 3 ── Style & mdoc      │◄── docs-reviewer agent
│  • docs-writing-style rules  │    (docs-writing-style
│  • mdoc modifier correctness │     + docs-mdoc-conventions
│  • docs-verify-compliance    │     + docs-verify-compliance)
│                              │
│  ► Present findings, ask:    │
│    Fix now / Fix later /     │
│    Proceed as-is             │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  Phase 5: Summary            │
│  • File path created         │
│  • Decisions made            │
│  • Suggested next steps      │
│    (sbt docs/mdoc, PR, etc.) │
└──────────────────────────────┘
```

## Troubleshooting

### Researcher takes too long
**Issue**: Phase 2 agents are slow
**Solution**: This is normal for large codebases. The thoroughness pays off in better understanding. Agents run in parallel when possible.

### Too many review issues
**Issue**: Phase 4 finds many problems
**Solution**: This is expected on first documentation pass. The maker-critic loop and structural review catch gaps that would otherwise require manual iteration. Choose "Fix now" and let the agents help.

### Critique loop doesn't converge
**Issue**: Still has findings after 3 rounds
**Solution**: High-priority issues may remain unresolved. Review them manually—some require code changes in the documentation or examples to be correct.

## Tips

- **Be specific in your topic**: "Ref" vs "zio.Ref" — full names help the researcher find the right code
- **Trust the workflow**: Each phase builds on the previous one
- **Review researcher findings**: Use them to inform what sections to emphasize
- **Choose "Fix now" for structural issues**: Architectural gaps should be fixed immediately
- **Let style fixes accumulate**: Minor style issues can be fixed in a batch commit

## Author

Milad Khajavi

## Version

0.1.0

## License

Apache-2.0
