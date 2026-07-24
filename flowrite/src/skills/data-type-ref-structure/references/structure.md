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

## Core vs supporting depth

A **supporting** type (research marks it `supporting`, or application code rarely uses it directly —
it exists to serve other module types) gets a MINIMAL page: the opening definition (role + grouped
structural-shape block) + one `## Usage` example + optional important-note admonition(s). Skip
Creating Values, Core Operations subsections, Comparisons, and Integration.

A **core** type gets the full template below.

## Structural Template

Sections marked **(required)** must appear. Sections marked **(if applicable)** appear only when relevant.
Keep them in this order.

```
1. Opening Definition (required) — NO HEADING
   - Start immediately after the frontmatter, no `##` heading, with a beginner-friendly, plain-language definition: what the type IS and what it's FOR, in 1-3 sentences. Inline-code the type signature and explain the type parameters.
   - Keep the opening an overview — defer implementation mechanism to later sections.
   - Optionally list key design properties as a few compact bullets ("Lock-Free — ...", "Atomic — ...") —
     only the important, non-obvious ones.
   - Then a plain ```scala block (NOT mdoc): the declaration (type params, variance, extends) and its
     main members, grouped by purpose with brief `//` comments — trait and companion members separate.
     No bodies, no private members. Show representative members, not every overload; collapse long
     homogeneous lists (e.g. `given` instances) to one commented line + a sentence noting more exist.
2. Motivation / Use Case (if applicable)
   - The problem and why this type solves it, told as a short realistic scenario.
3. Usage (required)
   - Core capabilities in one `mdoc:reset` block (~10-20 lines) so a reader grasps the idea without reading on.
4. Installation (if applicable — top-level module types only)
   - `libraryDependencies += "dev.zio" %% "<library>" % "@VERSION@"` (`%%%` for cross-platform).
5. Creating Values (required)
   - Every way to build a value: companion factories (apply, empty, from*, of), smart constructors,
     builders, conversions, predefined instances. One Markdown subsection per method.
   - When the type is a `case class` built via its primary constructor, show the real case-class
     declaration (`final case class T[..](params) { ... }`) — NOT a fabricated `def apply`. Only
     render an `object`-level `apply`/`empty`/`from*` when the companion source actually declares it.
   - Closed sealed hierarchy of homogeneous variants (nullary cases or single-field wrappers, no
     variant-specific API): one shared construction example, not one subsection per variant — tabulate
     them in Subtypes / Variants.
6. Predefined Instances (if applicable)
   - Predefined values (e.g. TypeId.int) grouped by category in a table or code block.
7. Core Operations (required)
   - The primary API grouped by category (Element Access, Transformations, Combining, Querying, Conversion).
   - Each category `###` opens with a one-line intro previewing what the category does and naming its methods, before the first method `####`.
   - One subsection per method (see Drafting Rules for the per-method shape).
   - A family differing only by type (`getInt`/`getLong`/…): ONE table + one example + shared caveats
     once, not a subsection each. A member earns its own subsection only if it genuinely differs.
8. Subtypes / Variants — only if subtypes need explaining; omit when self-evident (e.g. trivial
   value wrappers), even if subtypes exist.
   - When kept: ONE table (variant | field type | meaning) + one `match`. A variant earns its own
     subsection only if it genuinely differs.
9. Comparison Sections (rare; usually omit) — only against a real, widely-known external analogue
   (JDBC, Slick/Doobie/Hibernate, stdlib, established theory), padded tables. Never a strawman.
10. Advanced Usage / Building Blocks (if applicable) — how it composes into higher-level abstractions.
11. Integration (if applicable) — this type's direct edges only: a few sentences + relative-path
    links (e.g. [Schema](./schema.md)). Omit if Creating Values / Core Operations already cover them.
    In a module, link to the index's "How They Work Together"; never redraw the module diagram.
12. Running the Examples (required when standalone example files exist)
    - Per example, a collapsible `<details><summary>` embedding its source via
      `mdoc:embed:<library>-examples/<pkg>/src/main/scala/<pkg>/<File>.scala:show-line-numbers`,
      a short sentence on how to run it, and its `sbt "<pkg>/runMain ..."` command. Place last.
```

## Drafting Rules

When writing the page from this template:

- **Opening definition has NO heading** — it is the natural opening prose right after the frontmatter.
- **Document every public method** on the type and its companion object. Exhaustiveness is the point —
  but a member/variant is "accounted for" by a table row, not only a subsection. A variant table is
  exhaustive; 19 identical subsections are not.
- In Creating Values and Core Operations, group related methods under a **capability/task title**; the header names the intent, not an API symbol, and the method names + signatures live in the body:
  ✅ `#### Transforming elements` (body: `map(f)`, `flatMap(f)`, `collect(pf)`)
  ❌ `#### \`map\` — Transform each element`
  Under each title:
  1. Prose naming the grouped methods and what they do.
  2. One **signature** block (simplest trait/object form — just name, params, return type; no `override`/`final`/`sealed`; companion methods inside `object`). A *type* declaration instead keeps its real keywords (`case class`, `sealed trait`, `final`) and primary-constructor params; never synthesize a `def apply` the source lacks.
  3. A **usage example** (Setup + Evaluated Output) in a single `mdoc:silent:reset` / `mdoc:reset` block.
  4. Important caveats as admonitions (per `mdoc-conventions`).
- A `###` with one `####` restating it → inline the child (or give the parent ≥2 subsections).
- **Between any two code blocks put an explanatory paragraph** — never leave two fenced blocks adjacent.
- Note performance characteristics inline when relevant (O(1), O(n)).
- Use ASCII art for type hierarchies. Link related docs with relative paths `[TypeName](./type-name.md)`.
- Ground every signature and example in the real source — never invent an API surface.
