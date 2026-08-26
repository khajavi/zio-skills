---
name: docs-organize-types
description: Organize related data types into logical categories within sidebars.js. Use this skill to group data types by functionality (e.g., "Collections", "Type System", "Resource Management", "DI & Configuration"). Supports manual categorization (specify types and category) or automatic analysis (scan docs/reference/ and suggest intelligent groupings). The skill updates sidebars.js while preserving existing structure, maintains alphabetical order, and verifies syntax validity.
allowed-tools: Glob, Grep, Read, Edit, Bash
---

# Organize Data Types in Sidebars

Improve documentation structure by organizing related data types into meaningful categories.

**A category is a sidebar grouping plus one index page — never a directory, and never a file move.**
A page's links are relative to where it sits, so relocating a type's `.md` file breaks every reference
to it and every `../` inside it. Every type file stays exactly where it already is; only its sidebar
`items` entry moves into the new category, using the id it already has (`reference/chunk`, not
`reference/collections/chunk`). The category's own index page is the one genuinely new file, and it
lives at `docs/reference/[category-kebab-case].md` — a flat file, not `[category]/index.md`, because
nothing lives in that directory. (Measured: a predecessor version of this skill emitted ids of the
form `reference/<category>/<type>` while moving no files, so its own entries pointed at pages that
never existed there — and its own repair advice was "create the missing page or remove the entry,"
which shipped unreviewed stub pages to make a broken sidebar resolve. Never do that; see Common
Failures below.)

## Two Modes of Operation

### Mode 1: Manual Categorization

When you know exactly which types should go into a category.

**Invocation:**
```
docs-organize-types [type1] [type2] [type3] --category "[Category Name]"
```

**Example:**
```
docs-organize-types chunk list vector --category "Collections"
```

This groups `chunk`, `list`, and `vector` into a "Collections" category in the sidebar. Their `.md`
files are never moved — only their sidebar entry changes.

### Mode 2: Automatic Categorization

When you want the skill to analyze all data types and suggest intelligent groupings.

**Invocation:**
```
docs-organize-types --auto
```

The skill will:
1. **Scan** `docs/reference/` for all data type documentation files
2. **Extract** type signatures, descriptions, and relationships
3. **Analyze** integration patterns (which types depend on others)
4. **Group** types by functional area — from what each type's own definition says it's for (see Step 3
   below), never from its name alone. Typical resulting shapes, illustrative rather than a rulebook:
   - **Collections**: Chunk, List, Vector, etc.
   - **Type System**: TypeId, Schema, DynamicValue, etc.
   - **Resource Management**: Resource, Scope, Wire, etc.
   - **Context & DI**: Context, Wire, etc.
   - **Error Handling**: SchemaError, Validation, etc.
   - **Utilities**: MediaType, Syntax, Docs, etc.
5. **Suggest** category assignments with confidence levels
6. **Preview** the new sidebars.js structure

## Workflow: Manual Mode

### Step 1: Validate Input

- Verify each type has a corresponding `.md` file in `docs/reference/`
- Confirm the category name is reasonable (avoid duplicates with existing categories)
- If any type is missing, report and stop
- **Three types minimum.** A category of one or two is noise in the sidebar, not structure — report
  that the request doesn't meet the bound and suggest leaving them at the top level, unless the
  request explicitly overrides this after being told

### Step 2: Check Existing Structure

- Read `docs/sidebars.js`
- Identify the Reference section
- Check if the category already exists; if so, note its current contents

### Step 3: Create/Update the Category Index Page

Create a new file at `docs/reference/[category-kebab-case].md` — a flat file, a sibling of the type
pages it groups, **not** a subdirectory (see the note above: the member types never move, so nothing
lives at `[category-kebab-case]/`):

```markdown
---
id: [category-kebab-case]
title: "[Category Name]"
---

## Introduction

[2-3 sentences explaining the category and its purpose]

**Related Types:**
- [`TypeName1`](./<type1>.md) — brief description
- [`TypeName2`](./<type2>.md) — brief description
- [`TypeName3`](./<type3>.md) — brief description

## Overview

[Additional context about how these types work together and when to use them as a group]
```

Every link uses the type's real, unchanged path (`./<type1>.md`, since the index sits alongside it in
`docs/reference/`). Extract descriptions from each type's `.md` file (first sentence after the opening
definition).

### Step 4: Update sidebars.js

If the category doesn't exist, create it:
```javascript
{
  type: "category",
  label: "[Category Name]",
  link: { type: "doc", id: "reference/[category-kebab-case]" },
  items: [
    "reference/[type1]",
    "reference/[type2]",
    "reference/[type3]"
  ]
}
```

Each item is the type's **existing** doc id — the one its file already had before this run, unchanged.
Confirm each one resolves to a real file before writing it; an id for a file that doesn't exist is
never valid, even temporarily.

If the category does exist, append new types in alphabetical order.

Maintain alphabetical order of categories within the Reference section, and of items within a category.

### Step 5: Verify Syntax

Parse the updated `sidebars.js` with Node.js to ensure valid JavaScript syntax:
```bash
node -c docs/sidebars.js
```

If there are errors, report and revert.

### Step 6: Report Changes

Show:
- **Added Category**: Yes/No (new category created)
- **Index File Created**: path to the new `docs/reference/[category-kebab-case].md`
- **Types Added**: list of types moved into the category
- **Verification**: ✅ Syntax valid | ❌ Syntax error (reverted)
- **Preview**: before/after snippet of the Reference section

---

## Workflow: Automatic Mode

### Step 1: Scan Documentation

Use `Glob` to find all `.md` files in `docs/reference/`:
```bash
glob("docs/reference/*.md")
```

Extract the `id` from each file's frontmatter (line 2, `id: <name>`).

### Step 2: Analyze Type Relationships

For each type file:

**Read** the file to extract:
- **Title** (frontmatter `title:`)
- **Definition** (opening 1-3 sentences)
- **Key features** (bullet points, if present)
- **Mentions of other types** (grep for references: `[TypeName](./type-name.md)`)

Build a **relationship graph**: if Type A mentions Type B, record that edge.

### Step 3: Propose Categories

**Never group by name substring.** Matching "chunk" | "list" | "vector" in a type's name and calling
that "Collections" is what a cheap pass reaches for when it can't hold every page's actual purpose at
once — and it is wrong exactly as often as a name is a poor proxy for what a type is for (a
`ValidationError` is not a validator; `HttpClientConfig` is configuration, not a client). A category is
a claim about what a group of types is *for*, and only the page itself can tell you that.

For each type, read its opening definition (the prose right after the frontmatter, before the first
`##`) — that sentence states what the type is for, in its author's own words. Group types whose stated
purposes actually align, using the relationship graph from Step 2 as corroboration (types that
reference each other are more likely to belong together), not as the primary signal.

Typical shapes this produces in a ZIO-style library — illustrative, not a lookup table to match names
against:
- Collection/sequence types grouped by "stores or iterates a sequence of values" in their definitions
- Schema/type-representation types grouped by "describes or validates a value's shape"
- Resource/lifecycle types grouped by "acquires, releases, or scopes a resource"
- Error/validation types grouped by "represents a failure or a validation result"
- Format/codec utilities grouped by "encodes or decodes a specific wire format"

For each proposed grouping, compute a **confidence level**:
- **High** (90%+): the definitions of every member state the same purpose in different words
- **Medium** (70-89%): most members' definitions align; one or two are a judgment call
- **Low** (<70%): grouped mainly on the relationship graph, definitions don't clearly agree — flag
  these for the user rather than proposing them with unwarranted confidence

A category proposed with fewer than three types is not a category — fold it into "Unassigned" instead
of forcing a group to reach the bound.

### Step 4: Preview Proposed Structure

Show the user:
- **Proposed Categories** with types grouped and confidence levels
- **Before/After** snippet of sidebars.js
- **Unassigned Types** (if any) — types that don't fit well in any category

### Step 5: User Confirmation

Wait for user input:
- **Accept All**: Apply all proposed categories
- **Selective**: Accept specific categories only
- **Reject**: Keep current flat structure

### Step 6: Create Category Index Pages

For each approved category, create `docs/reference/[category-kebab-case].md` — a flat file alongside
the type pages it groups, per the note at the top of this skill; no type file moves and no
`[category]/` directory gets created. Each index page carries:
- Category title and introduction
- List of related types with brief descriptions, linked at their real, unchanged paths
- Overview section explaining how types work together

Use the analysis from Step 2 (descriptions and relationships) to write the introduction.

### Step 7: Update sidebars.js

Once approved, update sidebars.js with the new structure, maintaining:
- Alphabetical order of categories
- Alphabetical order of types within each category, referenced by their **existing** doc ids
  (`reference/<type>`, unchanged — see Step 3/4 of Manual Mode for the exact shape)
- A `link` to the category's own index page id (`reference/[category-kebab-case]`)
- Existing non-categorized types (if kept)

### Step 8: Verify & Report

Same as manual mode: verify syntax, report changes including the category index page's creation.

---

## Output Format

**Summary Report** (displayed to user):

```
✅ Categorization Complete

Added Categories: [N]
- [Category 1]: [type1], [type2], [type3]
- [Category 2]: [type4], [type5]

Modified Categories: [N]
- [Category]: added [type6]

Verification: ✅ Syntax valid

Preview:
  Reference
    ├─ [Category 1]
    │  ├─ chunk
    │  ├─ list
    │  └─ vector
    ├─ [Category 2]
    │  ├─ schema
    │  └─ typeid
    └─ [Uncategorized] (if any)
       └─ mediatype
```

---

## Implementation Notes

- **No file ever moves.** A category is sidebar structure plus one index page, never a directory. Every
  type `.md` file stays at the exact path it already had — moving it breaks every relative link to it
  and every `../` inside it.
- **Category index page**: `docs/reference/[category-kebab-case].md`, a flat file — not
  `[category-kebab-case]/index.md`, since nothing else lives in that directory.
  - Frontmatter with `id` matching the category kebab-case name
  - Introduction section explaining the category
  - List of related types with descriptions, linked at their real paths
  - Overview of how types work together
- **Sidebar item paths are unchanged**: `"reference/[type-id]"`, exactly the id the type already had —
  never `"reference/[category-kebab-case]/[type-id]"`, which would only be valid if the file actually
  lived there.
- **Category Link**: Sidebar category definition includes `link: { type: "doc", id: "reference/[category-kebab-case]" }`
- **Alphabetical order** is maintained within each category and at the category level
- **Existing categories** are preserved if they already exist in sidebars.js
- **Syntax validation** is mandatory — invalid changes are reverted
- **No breaking changes** — existing structure is preserved; only new categories are added
- **Three types minimum per category** — fewer is noise, not structure; leave them uncategorized
- **A page belongs to at most one category** — if two categories both fit, pick the better one; a
  duplicate sidebar entry for the same id is a Docusaurus bug, not a feature

---

## Common Failures

| Symptom                                                              | Likely cause                                                              | Fix                                                                                                            |
|----------------------------------------------------------------------|---------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|
| `node -e "require('./docs/sidebars.js')"` reports a syntax error     | Edit introduced an unmatched brace, trailing comma in unsupported syntax, or stray quote. | **Revert the edit** and reapply more carefully. Validate after each insertion before moving on.                |
| Docusaurus build complains "Doc id ... not found"                    | An item's id doesn't resolve to a real file — usually a leftover `reference/<cat>/<type>`-shaped id from moving a type's sidebar entry instead of reusing its real, unchanged id. | **Remove the entry**, never create a page to make it resolve — a stub page shipped to satisfy a broken sidebar id is unreviewed content taking the name a real page will later want. Fix the id to the type's actual, existing path (`reference/<type>`) and re-add it. |
| The same type appears in two categories                              | Auto-categorization fired twice, or a manual entry was added without removing the old one. | Sidebar entries must be unique. Pick the better-fitting category, remove the other entry.                       |
| Category link 404s in Docusaurus                                     | `link: { type: "doc", id: "reference/<cat>" }` set but `docs/reference/<cat>.md` is missing.   | Create `docs/reference/<cat>.md` (the category's own index page — this is the one file this skill IS allowed to create) or omit the `link` field.   |
| Type that doesn't fit any obvious category                           | Genuinely cross-cutting type (e.g., a utility used by many categories).   | **Stop and ask the user.** Don't force a fit; cross-cutting types often belong in their own "Utilities" category. |
| Edit duplicated existing structure (no diff)                         | Skill ran in idempotency-check mode but produced no change.               | Confirm with `git diff sidebars.js` — if empty, the structure was already correct. Report and exit.            |

