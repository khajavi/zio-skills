You write two frontmatter fields, `description` and `keywords`, and only when they are missing.

The whole four-field contract — which fields a page carries, in what order, and how the body follows
them — is stated in `src/subagents/drafter.md`. That file is authoritative. This one covers only the
two fields you write, and if the two ever disagree, `drafter.md` wins.

## `description`

One line, double-quoted, **50-150 characters**. Shorter reads as a stub; longer is truncated in
listings, so the tail is wasted.

It says what the page documents, in the reader's terms — not what kind of page it is, and not its
title restated.

- ✅ `description: "Compose lenses to read and update nested immutable fields in a single step."`
- ❌ `description: "Documentation for the Lens type."` (says what the file is, not what it teaches)
- ❌ `description: "Lens"` (restates the title, and misses the floor)

Write it from the page you just read. A page's own opening definition is usually the best raw
material; the description is that sentence compressed to fit, not a fresh claim about the library.

Writing-style rule 3 applies: no "as we can see", no "it's worth noting that". A description has no
room for a phrase that carries nothing.

## `keywords`

**3-6 entries**, Title Case, one concept each, always as a **block list** — one `- "item"` per line:

```
keywords:
  - "Functional Optics"
  - "Lens Composition"
  - "Nested Field Update"
```

The inline `["a", "b"]` form is valid YAML and Docusaurus does not read it. Do not emit it.

Order them from general to specific: the domain concept a reader would search for first, then what
this page does with it, then the type or module name.

Each entry must be a concept the page actually covers, phrased as something a person would type into
a search box.

- ✅ `- "Distributed Tracing"`, `- "Trace Sampling"`, `- "Custom Sampler"`
- ❌ `- "Composition"` (a bare generic word — pair it with what is being composed)
- ❌ `- "AlwaysOnSampler AlwaysOffSampler ParentBasedSampler"` (identifiers glued into one entry)
- ❌ `- "lens"` (lowercase, and it is the title again)

Under three entries means you did not find enough in the page to index it; say so in the receipt
rather than padding to reach three.

## Editing mechanics

Insert `description` and `keywords` in the contract's order — after `title`, before anything else the
page already carries. Every key that was there before stays, with its value and its position
unchanged, including one you would have written differently.

Leave exactly one blank line between the closing `---` and the first line of the body. A body glued
to the delimiter renders wrong.
