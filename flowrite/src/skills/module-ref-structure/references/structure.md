# Module Reference Structure

A module reference documents a **cohesive domain model of several related types** — a module such as
an HTTP model (`Request`, `Response`, `URL`, `Headers`, …) or resource management (`Scope`,
`Resource`, `Wire`). Unlike a data type reference (ONE type, exhaustive), a module reference
emphasizes three things a single-type page cannot:

- **Module narrative** — how the types work together, the common patterns, the architectural relationships.
- **Type-level coverage** — each type documented, contextualized within the module (not in isolation).
- **Multi-type examples** — composition and cross-type usage, not just single-type API snippets.

## Layout: Flat vs. Hierarchical

Pick one layout for the whole module. The design phase decides this from the auto-rule below (an
explicit `layout` override wins when supplied).

| Module shape                                                    | Layout          |
|----------------------------------------------------------------|-----------------|
| ≤ 4 core types, or types always used together                  | **flat**        |
| ≥ 5 core types, **or** ≥ 3 types with rich self-contained APIs | **hierarchical**|

**Flat** — single file `docs/reference/<module-kebab>.md`. All types documented inline with `##`
headings. Best when types are tightly coupled or always used together (e.g. an HTTP model).

```
---
id: <module-kebab>
title: "<Module Title>"
---
```

**Hierarchical** — index + subpages: `docs/reference/<module-kebab>/index.md` plus one
`docs/reference/<module-kebab>/<type-kebab>.md` per type, linked from the index. Best when types
have self-contained value and readers benefit from deep-dive pages (e.g. resource management).

```
---
id: index
title: "<Module Title>"
---
```

Each hierarchical subpage follows the **data type reference** structure completely, recontextualized
to the module (see "Recontextualization" below).

**Sub-domain nesting (hierarchical, ≥ 2 distinct sub-domains).** Nest each sub-domain under
`<module-kebab>/<sub-domain-kebab>/` with its own `index.md` (that sub-domain's intro); the module
`index.md` becomes a map — a blurb + link per sub-domain. Otherwise keep subpages flat under `<module-kebab>/`.

**Homogeneous family → one page.** Sibling types with the same shape, differing only by value type,
share ONE page (common shape once, then a per-type table/subsection for what differs):
✅ `Counter`/`UpDownCounter`/`Histogram`/`Gauge` on one `meter.md` ❌ four near-duplicate pages.

## Module-Level Sections (BOTH LAYOUTS — this is the module page / the flat page's top matter)

Keep them in this order. Sections marked **(required)** must appear; **(if applicable)** appear only
when relevant.

```
1. Opening Definition (required) — NO HEADING
   - Immediately after the frontmatter: what the module provides, in 1-3 sentences.
   - List the core types as inline code: `Type1`, `Type2`, `Type3`.
   - A plain ```scala block (NOT mdoc) showing the structural shape of the 2-3 main types
     (declarations only — no bodies).
2. Motivation / Use Case (if applicable)
   - What problem the module solves and why use it over alternatives; advantages as bullets.
3. Installation (if applicable — top-level module only)
   - `libraryDependencies += "dev.zio" %% "<module>" % "@VERSION@"` (`%%%` for cross-platform).
4. Overview (hierarchical) / optional for flat
   - 2-3 sentences per core type: what it does, its role, a link to its subpage (hierarchical)
     or its `##` section (flat).
5. How They Work Together (required — THE CENTERPIECE, never skip)
   - The typical workflow / data flow as numbered steps.
   - An ASCII diagram of the type relationships and interactions.
   - How each type uses / depends on / composes with the others.
6. Common Patterns (required when the module has named patterns)
   - Named, module-specific patterns: decision trees for choosing between variants,
     realistic multi-type composition examples (not single-type snippets).
7. Integration Points (if applicable)
   - Which types use which internally; how this module integrates with other modules;
     relative-path cross-references to related docs.
8. Type-Level Documentation
   - flat: an `##` section per type (see "Per-Type Section — Flat" below), in the planned type order.
   - hierarchical: not here — each type is its own subpage.
9. Running the Examples (required when standalone example files exist)
   - Prefer ONE module-level section showing a cross-type workflow, per data-type-ref's
     `mdoc:embed` + collapsible `<details>` convention. Place last.
```

## Per-Type Section — Flat (lighter than a full data type reference)

For a flat page, document each type inline under an `##` heading. Cover every public member, but
group concisely — this is lighter than a standalone data type reference:

- Brief definition + type signature + key properties (no heading for the first type's definition
  if it directly follows the module top matter; otherwise `##<TypeName>`).
- Subsections by category as they apply: **Predefined Instances**, **Creating Values**,
  **Key Operations** (2-3 representative methods per functionality group), **Rendering**.
- **One example per operation group**, not exhaustive edge cases. Note performance inline (O(1), O(n)).
- Link to the module-level "How They Work Together" / patterns sections for composition, instead of
  repeating cross-type examples per type.

## Per-Type Subpage — Hierarchical (full data type reference depth)

Each subpage follows the data-type-ref structure COMPLETELY. Apply the **Recontextualization rule**:
in each section, note how the type relates to the other types in the module.

- Opening definition — say whether the type is a core export or a supporting helper.
- Creating Values — note when it is built with other module types.
- Core Operations — show composition with sibling types where relevant.
- Integration — highlight module-level relationships first (siblings), external modules second.
- Comparisons may stay per-subpage (vs other languages / related types) or move to the index when
  comparing types within the module.

## Drafting Rules (both layouts)

- The opening definition has NO heading — it is the natural opening prose after the frontmatter.
- The "How They Work Together" section is mandatory and is the reason a module reference exists —
  never omit it; ground its data flow and ASCII diagram in the real relationships from research.
- Between any two code blocks put an explanatory paragraph — never leave two fenced blocks adjacent.
- Use ASCII art for type relationships. Link related docs with relative paths
  (`[TypeName](./type-name.md)`, or `[TypeName](./<module>/<type>.md)` across pages).
- Ground every signature, example, and relationship in the real source — never invent an API surface
  or a relationship the code does not have.
