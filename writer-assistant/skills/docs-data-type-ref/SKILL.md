---
name: docs-data-type-ref
description: Write reference documentation for a specific ZIO data type. Research the type, write comprehensive documentation with examples, verify mdoc compilation, and integrate into docs.
tags: [documentation, data-type, reference, zio, agent-skills]
---

# Data Type Reference: Conceptual Overview

A data type reference page is **task-independent, comprehensive API documentation** for a single ZIO type. It is not a tutorial (teaching concepts) or how-to guide (achieving a goal) — it documents everything about one type for practitioners who need authoritative API details.

## Core Properties

- **Documents every public method** on the type and its companion object
- **All code examples compile** with zero mdoc errors
- **Precise section order** — readers navigate by scanning headings, so sequence matters
- **No duplication** — each method appears exactly once

## Section Structure

1. **Opening Definition** — NO heading, immediately after frontmatter; type signature + key properties + plain `scala` structural shape
2. **Motivation / Use Case** (if applicable) — problem + why this type solves it
3. **Quick Showcase** — 1–3 examples in a single `mdoc:reset` block showing core capabilities
4. **Installation** (if applicable) — `libraryDependencies` for top-level module types
5. **Construction / Creating Instances** — all factory methods, smart constructors, conversions
6. **Predefined Instances** (if applicable) — variants, constants in a table or block
7. **Core Operations** — grouped methods: Element Access, Transformations, Combining, Querying, Conversion
8. **Subtypes / Variants** (if applicable) — when to use each, how to create, differing operations
9. **Comparison** (if applicable) — contrast with Java/Scala stdlib equivalents
10. **Advanced Usage** (if applicable) — composition with other types
11. **Integration** (high-confidence only) — only when non-trivial cross-module wiring with a runnable example
12. **Running the Examples** (when standalone examples exist)

## mdoc Conventions

- Method signatures: plain `scala` block (no mdoc)
- Usage examples: `mdoc:reset` block
- Setup + output in a single block — never split
- No blank lines between consecutive code blocks

## Quality Gate

Every method documented, zero mdoc compilation errors, frontmatter `id` matches filename.
