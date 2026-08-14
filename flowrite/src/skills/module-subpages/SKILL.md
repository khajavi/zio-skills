---
name: module-subpages
description: How to write the per-type subpages of a hierarchical module reference — the per-type loop, sub-domain nesting, and the sub-domain index page. Use when a module's design plan chose the hierarchical layout (core-family or multi-domain shapes); a flat module page has no subpages.
---

# Module Reference Subpages

A hierarchical module reference is an index page plus one subpage per type. The index carries the
narrative; the subpages carry the API. Skip everything here for a flat layout (`single-core` or `dsl`) —
a flat page documents its types inline and has no subpages.

## The per-type loop

For EACH type in the plan's `typeGroups` — each group has a `label` and its `types`, each with a `kind`:

1. Delegate to the `researcher` subagent for that type's full public API, writing to
   `.flowrite/research/data-type-<type-kebab>.md`. One delegation per type, and read each file before
   drafting from it.
2. Delegate to the `drafter` subagent for the subpage. Tell it:
   - the research file path,
   - the page path `docs/reference/<module-kebab>/<type-kebab>.md`,
   - how this type relates to its siblings, from the module research's relationships,
   - its group `label`, and its `kind`.

**One delegation per type, both steps.** Give each type its own researcher call and its own drafter
call, even when two types look small enough to batch:
✅ two drafter delegations, one per subpage ❌ one delegation asking for "TWO per-type subpages"
Batching is where a subpage picks up its sibling's API: a module run handed the drafter `Lens`'s
research alongside `Iso`'s plan and produced a page naming four methods `Lens` does not have. Two types
is where batching looks safe; four is where it stops being.

**There is no design step for a subpage.** No plan exists for it, and none should be invented: the
drafter decides the sections from the structure template and the research it was given. Never reuse
another type's plan — a module run once handed the drafter `Lens`'s research alongside `Iso`'s plan and
produced a page naming four methods `Lens` does not have.

`kind` sets the depth: a `core` type gets a full page, a `supporting` type gets a minimal one. Fold a
homogeneous family of variants onto one page rather than writing near-identical pages.

## Sub-domain nesting

With two or more sub-domains, nest a directory per sub-domain:

```
docs/reference/<module-kebab>/index.md                       ← the module map
docs/reference/<module-kebab>/<sub-domain-kebab>/index.md    ← one per sub-domain
docs/reference/<module-kebab>/<sub-domain-kebab>/<type>.md   ← the types
```

Each sub-domain `index.md` follows the **"Sub-domain index page"** template in `module-ref-structure`:

1. Lead with the sub-domain's entry-point object, if it has one, documented comprehensively and
   organized by behaviour or task — a subsection per capability. It gets no page of its own, so this is
   its only coverage.
2. A problem-first end-to-end `## Usage` recipe.
3. The type roster, grouped by domain concern.

## Prose written by hand

You write the sub-domain index pages yourself with the `write` tool rather than delegating them, so no
role's instructions supply the writing-style rules — apply them from your own `writing-style` skill.
The rule that matters most here: **link each sibling type's first prose mention to its subpage**, as
``[`TracerProvider`](./tracer-provider.md)``. Verify a page exists before linking to it.
