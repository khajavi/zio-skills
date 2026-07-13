# Data Type Reference Structure

A data type reference page documents ONE type exhaustively: its full public API, organized by
category. Unlike a tutorial (narrow, narrative, one concept), a reference page is a complete map of
the type — a reader lands here to look up any constructor or operation.

Place the file at `docs/reference/<type-name-kebab-case>.md`. The frontmatter `id` must match the
filename without `.md`:

```
---
id: <kebab-case-id>
title: "<TypeName>"
---
```

## Structural Template

Sections marked **(required)** must appear. Sections marked **(if applicable)** appear only when relevant.
Keep them in this order.

```
1. Opening Definition (required) — NO HEADING
   - Start immediately after the frontmatter with a concise, technical definition. No `##` heading.
   - Inline-code the type signature; explain the type parameters; state the core purpose in 1-3 sentences.
   - Optionally list key properties as bullets ("Lock-Free — ...", "Atomic — ...").
   - Then a plain ```scala block (NOT mdoc) showing only the structural shape: the trait/class
     declaration with type params, variance, and extends clauses — no method bodies, no private members.
2. Motivation / Use Case (if applicable)
   - The problem and why this type solves it, told as a short realistic scenario.
3. Quick Showcase (required)
   - Core capabilities in one `mdoc:reset` block (~10-20 lines) so a reader grasps the idea without reading on.
4. Installation (if applicable — top-level module types only)
   - `libraryDependencies += "dev.zio" %% "<library>" % "@VERSION@"` (`%%%` for cross-platform).
5. Construction / Creating Instances (required)
   - Every way to build a value: companion factories (apply, empty, from*, of), smart constructors,
     builders, conversions, predefined instances. One Markdown subsection per method.
6. Predefined Instances (if applicable)
   - Predefined values (e.g. TypeId.int) grouped by category in a table or code block.
7. Core Operations (required)
   - The primary API grouped by category (Element Access, Transformations, Combining, Querying, Conversion).
   - One subsection per method (see Drafting Rules for the per-method shape).
8. Subtypes / Variants (if applicable) — when to use, how to create, differing operations, conversions.
9. Comparison Sections (if applicable) — vs Java/Scala-stdlib/theory analogues, in padded tables.
10. Advanced Usage / Building Blocks (if applicable) — how it composes into higher-level abstractions.
11. Integration (if applicable) — how it connects to sibling types in the same library, with
    relative-path cross-references (e.g. [Schema](./schema.md)).
12. Running the Examples (required when standalone example files exist)
    - Embed each example with `SourceFile.print` (see references/embedding-examples.md). Place last.
```

## Drafting Rules

When writing the page from this template:

- **Opening definition has NO heading** — it is the natural opening prose right after the frontmatter.
- **Document every public method** on the type and its companion object. Exhaustiveness is the point.
- For **each method** in Construction and Core Operations, use this shape:
  1. A Markdown subheader ``` `MethodName` — Brief description ``` (e.g. `` `Chunk#map` — Transform elements ``).
  2. Plain-language explanation of what it does.
  3. The **signature** in a plain `scala` block using the simplest trait/object interface form —
     just name, params, return type; no `override`/`final`/`sealed`. Companion methods shown inside `object`.
  4. A **usage example** using the Setup + Evaluated Output pattern in a single `mdoc:silent:reset`
     (or `mdoc:reset`) block: setup first, then the call showing its result (e.g. `p.name // Alice`).
  5. Important caveats as Docusaurus admonitions (per the `mdoc-conventions` skill).
- **Between any two code blocks put an explanatory paragraph** — never leave two fenced blocks adjacent.
- Note performance characteristics inline when relevant (O(1), O(n)).
- Use ASCII art for type hierarchies. Link related docs with relative paths `[TypeName](./type-name.md)`.
- Ground every signature and example in the real source — never invent an API surface.
