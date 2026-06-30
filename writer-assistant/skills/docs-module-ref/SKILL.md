---
name: docs-module-ref
description: Write reference documentation for a module containing multiple related data types. Use when documenting a cohesive domain model (e.g. http-model, resource-management) where types work together as a system.
tags: [documentation, module, reference, zio, agent-skills]
---

# Module Reference: Conceptual Overview

A module reference documents a **cohesive set of related data types that work together as a system**. It is not a single data-type reference (which documents one type exhaustively) — it emphasizes how types compose and interact.

## Core Properties

- **Documents every public method** on every core type
- **"How They Work Together" is the centerpiece** — never skip it; always includes ASCII diagram of type relationships and numbered workflow
- **All code examples compile** with zero mdoc errors
- **Structure chosen by module shape** — not arbitrary

## Structure Rule

| Module shape                                               | Structure                                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| ≤ 4 core types, or types always used together              | **Flat** — single file at `docs/reference/<module-name>.md`                    |
| ≥ 5 core types, OR ≥ 3 types with rich self-contained APIs | **Hierarchical** — `docs/reference/<module-name>/index.md` + one page per type |

Decide before writing. State which structure and why.

## Module-Level Sections (required)

1. **Opening Definition** — NO heading, immediately after frontmatter; 1–3 sentences + core type list + plain `scala` structural shape
2. **Introduction / Motivation** — module role and problem solved
3. **Installation** — `libraryDependencies` snippet
4. **How They Work Together** — ASCII diagram of type relationships + numbered workflow steps
5. **Common Patterns** — multi-type composition examples, decision tree for choosing types
6. **Integration Points** — intra-module relationships, ZIO ecosystem connections

## Type-Level Sections

- **Flat:** inline `##` heading per type — definition, predefined instances, construction, key operations, rendering
- **Hierarchical:** full page per type following `docs-data-type-ref` conventions, plus a recontextualization note in each section linking back to sibling types

## mdoc Conventions

- Method signatures: plain `scala` block (no mdoc)
- Usage examples: `mdoc:reset` block
- Setup + output in a single block — never split
- No blank lines between consecutive code blocks
