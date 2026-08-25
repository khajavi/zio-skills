# How-To Guide Structure

Design the section structure before writing a word. A how-to guide is goal-oriented: it takes a
practitioner who already knows the library and walks the shortest correct path to ONE finished task.
Unlike a tutorial (which builds understanding for a newcomer) it decides for the reader; unlike a
reference page (which maps a type exhaustively) it introduces only what the goal needs.

Place the file at `docs/guides/<id>.md`, where the `id` names the task rather than a type. The
frontmatter `id` must match the filename without `.md`:

```
---
id: <kebab-case-task-id>
title: "<Task, as a Reader Would Search for It>"
---
```

`docs/guides/` also holds tutorials, so list the directory before settling on an `id` — a path that
already exists belongs to another page.

## Structural Template

Every heading below is the **literal text to emit**. Sections marked **(required)** must appear.
Keep them in this order.

```
## Introduction (required)
   - One paragraph: the concrete outcome the reader will have, why it is worth having, and the
     approach in a single sentence.
   - No warm-up and no theory. The reader arrived with a task; name the outcome and move.

## The Problem (required)
   - The problem stated concretely — not "serialization is hard" but the specific shape of the pain.
   - What it costs: wasted time, runtime errors, boilerplate that has to stay in sync, code that
     breaks when a field is added. Consequences a reader recognizes in their own codebase.
   - A "before" example showing what the reader writes today. See "The before example" below for how
     it is fenced — this is the one section whose code is not about the library.
   - One to two short paragraphs plus that block. A Problem section that over-explains delays the
     goal it exists to motivate.

## Prerequisites (required)
   - The sbt dependency: `libraryDependencies += "dev.zio" %% "<library>" % "@VERSION@"`
     (`%%%` for cross-platform).
   - Base imports in one `mdoc:silent` block, so every later block shares them.
   - The assumed knowledge, stated plainly in a sentence — what the reader must already know for
     this guide to make sense.

## The Core Model (required)
   - The domain types the guide works with, in `mdoc:silent`.
   - Two or three sentences on why these types and how they relate to the goal. Keep them small:
     one or two fields each, grown later only if a step needs it.

(the capability sections — 3 to 6 of them, one `##` each)
   - Name each heading for the capability it delivers, in the reader's words:
     ✅ `## Validating Incoming Records`  ❌ `## Step 2`  ❌ `## Capability Section 2`
   - One to three sentences on what this step accomplishes and why it comes here.
   - The code, in an inline `mdoc` block — the evaluated output is the point of these sections, and
     an embedded file cannot render output.
   - The result, shown rather than described, so the reader can confirm the step worked before
     moving on.
   - Exactly one new capability per section. Two things happening means two sections.

## Putting It Together (required)
   - The complete runnable example combining every step.
   - Do NOT inline it. Use an EMPTY block fenced
     `scala mdoc:embed:<library>-examples/<id>/src/main/scala/<pkg>/CompleteExample.scala`
     (`<pkg>` = id without hyphens). The examples phase creates that file.

## Running the Examples (required)
   - git clone, then one `cd` straight into the examples module dir in a single path
     (e.g. `cd <repo>/<library>-examples`, not a separate `cd <repo>` and `cd <library>-examples`).
   - Per step, in order: a collapsible `<details><summary>` embedding that step's source via
     `mdoc:embed:<path>:show-line-numbers` (same pattern as Putting It Together); a short sentence on
     how to run it; its `sbt "<id>/runMain ..."` command.

## Going Further (optional)
   - Links to the reference pages for the types the guide used, related guides, and the variations
     this guide deliberately did not cover — all of them pages THAT EXIST. Check before linking, and
     write prose without a link when none does. Never a placeholder to be resolved later.
```

## The before example

The Problem section's "before" block shows what the reader writes **without this library**. Two
forms, and the first is the default:

- **`scala mdoc:compile-only`** — real code that compiles, and that does not reference the library
  being documented. This is almost always the right choice, because "what you write today" is
  ordinarily verbose *working* code: hand-rolled `copy()` chains, a match over every case, the same
  three lines repeated per field. The pain is the volume, not a compile error, so there is no compile
  error to dodge and nothing about the block a reader has to take on trust.
- **A plain ` ```scala ` fence** holding pseudocode or a bodiless sketch — only when the problem is
  architectural and no runnable code shows it ("forty case classes whose codecs, database mappings
  and OpenAPI specs must stay in sync"). Prefer a concrete scenario in prose over a fake code block.

Two rules hold in both forms:

- **Never use the documented library's API in this block.** A "before" that already uses the library
  is not a before; and an uncompiled block naming a real method is the one place a wrong signature
  can sit in a finished page uncaught.
- **Never rewrite it into idiomatic code.** Its verbosity is the section's entire argument. If it
  looks fine, either the problem is not real or the wrong example was chosen.

## Section Design Rules

- **The problem comes first**: no conceptual preamble ahead of it. A guide that opens by explaining
  what a type is has become a tutorial.
- **One canonical path**: never "alternatively", never "if you need X instead". Choosing is the
  service the guide provides.
- **One capability per section**, building toward the goal — each section leaves the reader closer to
  a working result than the last.
- **Every section has code**, excepting Introduction, The Problem's prose, and Going Further.
- **Show the result** after each step: printed output, or the type of what was produced.
- **Introduce a type when the goal needs it**, never ahead of time. Exhaustiveness is a reference
  page's job.
- **Sections should be independently valuable** where a reader can skim to one and still get
  something.
- **Limit scope aggressively.** A guide about building a query DSL does not become a guide about
  everything the library can do.
- **Never surface this template's vocabulary.** No heading contains `Step`, `Capability`, `Section`,
  `Concept`, or an ordinal this template supplied. The headings above are literal; the group labels
  in parentheses are not.

## Narrative Planning

1. **Name the finished result** — the thing the reader has at the end, concretely enough to run.
2. **Find the real "before"** — what they write today, from the research findings, not from
   imagination. If the research did not establish a painful current approach, the guide may not have
   a problem worth a page.
3. **Order the path by composition** — the steps follow the order the types compose in (first define
   X, then derive Y, then apply Z), not by what is easiest to explain.
4. **Plan the confirmations** — the points where printed output lets the reader verify the step
   behaved as claimed before they build on it.
5. **Decide what to leave out** — the variations, the edge cases, the second approach. They go in
   Going Further as links, or nowhere.

## Drafting Rules

When writing the guide from this structure:

- **Direct, imperative prose**: "Define a schema", "Derive the codec", "Run the effect". Never
  "Welcome", "Let's", "we will explore", "notice that" — that register belongs to tutorials.
- **Lead with the outcome, not with an announcement of the outcome.** State what the reader will
  have; do not spend a clause saying that you are about to state it.
- You will receive both this structure and the research findings. The structure says WHAT to cover;
  the research findings (especially `groundingDetail`) carry the REAL imports, signatures, and
  examples — copy them exactly, never substitute general knowledge.
- The findings' **history** section carries what the library's own commits and PRs state: which
  usages the compiler rejects, what a member used to be called, where a platform differs. Those are
  the gotchas a practitioner hits. Use each where it belongs — a warning beside the step it affects,
  a version note — retold in your own words, never quoting a commit or citing a PR number. Document
  nothing a finding contradicts, and invent nothing when history said nothing.
- **Between any two code blocks put an explanatory paragraph** — never leave two fenced blocks
  adjacent.
- Important caveats become admonitions, sparingly (per `mdoc-conventions`).
- Link a type's reference page on its first mention, with a relative path
  (`[TypeName](../reference/type-name.md)`) — and only if that page exists.
