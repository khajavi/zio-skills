---
name: docs-how-to-guide
description: Write a how-to guide on a specific topic in a ZIO library. Use when the user asks to write a guide or walkthrough that teaches how to accomplish a concrete goal using the library's data types and APIs.
argument-hint: "[guide title or topic description]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(sbt:*), Bash(sbt gh-query*), Bash(git:*), Task, Skill
---

# Write a How-To Guide

Write a comprehensive, goal-oriented how-to guide for the ZIO library being documented.

## Guide Topic

<!-- $ARGUMENTS is the slash-command argument the user passed (see argument-hint in
     the frontmatter). Claude Code substitutes the user's input here before
     loading the skill. If the substituted value is empty or just "$ARGUMENTS",
     the skill was invoked without a topic — fall back to the rule below. -->

$ARGUMENTS

If no topic appears above (or the literal text `$ARGUMENTS` is shown), ask the user what guide they want to write before proceeding. Do not invent a topic.

## Overview: What Makes a Good How-To Guide

A how-to guide is **goal-oriented** — it helps the reader accomplish a specific, concrete task. It is neither a reference page (which documents an API exhaustively) nor a tutorial (which teaches concepts step by step). A how-to guide assumes the reader already has basic familiarity and wants to get something done.

Key properties of a good how-to guide:

- **Starts with a clear goal**: The reader knows exactly what they will accomplish by the end.
- **Shows a practical, realistic example**: Not toy examples — something close to what a real user would build.
- **Introduces types and APIs only as needed**: No exhaustive API coverage; only what serves the goal.
- **Builds incrementally**: Each section builds on the previous one, progressing toward the goal.
- **Ends with a working result**: The reader has something functional at the end.

---

## Step 1: Deep Research — Understand the Topic Landscape

Before writing a single word, you must build a complete mental model of every type, method, pattern, and integration point relevant to the guide topic. This is the most critical step.

Delegate to the **`docs-researcher`** agent with the `Task` tool — it must NOT share your
conversation, so its only knowledge of what to research is what you tell it:

```
Task(
  description: "Research <topic> for a how-to guide",
  subagent_type: "documentation:docs-researcher",
  prompt: "Research <topic> for a goal-oriented how-to guide. Find: the specific problem this guide
           solves and what a reader would write to solve it without this library (a real 'before' code
           example); the minimal set of types and operations needed to reach the goal; the key decision
           points and common mistakes; for each core type, what it is and its role in reaching the
           goal; the dependency/composition order; factory methods and constructors the reader will
           actually use; the simplest starting point and the layers of complexity that can be added
           incrementally; imports and sbt dependency; commit history for why this is shaped the way it
           is."
)
```

Read its findings before proceeding — if they're missing or thin, say so and delegate again rather
than filling the gap yourself.

### 1e. Answer These Research Questions

Before proceeding to writing, you must be able to answer every one of these questions. Write the answers down (internally) as they will directly inform the guide structure:

**About the problem:**

1. What specific problem does this guide solve? State it concretely, not abstractly.
2. What happens if the reader does NOT have this solution? (boilerplate, runtime errors, maintenance burden, etc.)
3. How would the reader attempt to solve this without this library? Can you show a "before" code example?
4. Is this a common pain point that many developers face, or a niche scenario? (This affects how much you need to motivate the problem.)

**About the goal:**

5. What concrete thing will the reader have built/accomplished by the end of this guide?
6. What is the minimal set of types and operations needed to achieve this goal?
7. What are the key decision points where the reader must choose between approaches?
8. What are the common mistakes or pitfalls a reader might hit?

**About the types involved:**

9. For each core type: What is it, in one sentence? What role does it play in achieving the goal?
10. What is the dependency/composition order? (e.g., "First define a Schema, then derive a Codec, then use a Format")
11. Which factory methods and constructors will the reader actually use?
12. What type class instances are derived automatically vs. must be created manually?

**About the narrative arc:**

13. What is the simplest possible starting point? (The "hello world" for this goal)
14. What layers of complexity can be added incrementally? (e.g., start with a flat record, then add nesting, then add collections, then add custom types)
15. Where should you pause to show intermediate results? (e.g., print output, show JSON, demonstrate validation)
16. What is the natural ending point — the "complete" version?

**About the ecosystem:**

17. What imports does the reader need?
18. What sbt dependencies are required?
19. Are there Scala 2 vs. Scala 3 differences the reader should know about?
20. Does this integrate with other ZIO libraries (ZIO HTTP, ZIO Streams, etc.)?

---

## Step 2: Design the Guide Structure

Based on your research answers, design the guide's section structure before writing. A how-to guide follows this general skeleton:

### Structural Template

```
1. Introduction (what we're building and why)
2. The Problem (what problem we're solving, why it matters, example of the pain)
3. Prerequisites (dependencies, imports, assumed knowledge)
4. The Core Model (define the domain types we'll work with)
5. Step-by-step sections (each building toward the goal)
   - Each section: brief explanation → code → result/output
6. Putting It Together (the complete working example)
7. Running the Examples (how to clone the repo and run companion code)
8. Going Further (optional: variations, advanced techniques, links)
```

### Section Design Rules

- **Each section has exactly one new concept or capability.** If you find yourself explaining two unrelated things in one section, split it.
- **Every section has at least one code example.** No section should be pure prose.
- **Sections should be independently valuable** where possible — a reader skimming should be able to jump to a section and get value.
- **Use progressive disclosure:** Start with the simplest version that works, then add complexity. Do not front-load all the types and theory.
- **Limit scope aggressively.** A guide about "writing a query DSL" should not become a guide about "everything you can do with Schema." Stay on topic.

### Narrative Planning

Plan the running example that threads through the guide:

1. **Choose a realistic domain** — e.g., an e-commerce system, a blog platform, a user management system. Pick something readers can relate to.
2. **Define 3-5 domain types** that demonstrate the features you need. Start simple (1-2 fields) and grow them as the guide progresses.
3. **Plan the "show moments"** — points where you print, serialize, validate, or otherwise demonstrate that the code works. These are crucial for reader confidence.

---

## Step 3: Write the Guide

### File Location and Frontmatter

Place the file in `docs/guides/` directory. `docs/guides/` also holds tutorials — list the directory
before settling on an id; a path that already exists belongs to another page.

```
---
id: <kebab-case-id>
title: "<Guide Title>"
description: "A 50-150 character summary of the task this guide accomplishes."
keywords:
  - "General Domain Concept"
  - "Page-Specific Concept"
  - "<Core Type Name>"
---
```

`description` and each `keywords` entry are double-quoted; `keywords` is a block list (one `- "item"`
per line), 3-6 entries. Write these now — don't rely on a later docs-backfill-metadata pass.

The `id` must match the filename (without `.md`), and should name the task rather than a type
(`validate-json-schemas`, not `schema`).

### Writing the Sections

#### Introduction

Start with a single paragraph stating:
- What the reader will accomplish (the goal)
- Why this is useful (the motivation)
- What approach we will take (the strategy, in one sentence)

Then include a brief outline of what the guide covers — a bulleted list or a table of contents if the guide is long (more than 6 sections).

Do NOT start with theory or type definitions. Start with the promise of what the reader will build. A
guide that opens by explaining what a type is has become a tutorial — if you catch yourself doing
that, that's the signal, not a reason to justify it and keep going.

**Pattern:**
```
In this guide, we will build [concrete thing] using [key library types]. By the end,
you will have [tangible result] that [does something useful].

We'll take an incremental approach: starting with [simple version], then adding
[feature], [feature], and [feature] until we have a complete [thing].
```

#### The Problem

Immediately after the introduction, include a dedicated section that clearly states the problem this guide solves. This section has three parts:

1. **State the problem concretely.** Describe the specific pain point, challenge, or gap that motivates this guide. Be precise — "serializing data is hard" is too vague; "you need to serialize a deeply nested case class hierarchy to JSON without writing boilerplate encoders for each type" is concrete.

2. **Explain why it matters.** Connect the problem to real consequences the reader cares about: wasted time, runtime errors, maintenance burden, boilerplate explosion, fragile code, etc. Help the reader feel the weight of the problem so the solution feels earned.

3. **Show examples of the problem.** When possible, include a short code example (or a description of a scenario) that makes the problem tangible. Show what the reader's code looks like *without* the solution — verbose, error-prone, or brittle. This creates a clear "before/after" contrast with the rest of the guide.

**Pattern:**
```
## The Problem

[1-2 sentences naming the specific problem.]

[1-2 sentences explaining why this matters — what goes wrong if you don't solve it.]

For example, consider [a realistic scenario]:

​```scala mdoc:compile-only
// Without this library, you might write something like this:
// [show the painful/boilerplate/fragile approach — real code, real types, that actually compiles]
​```

This approach [breaks down when X / doesn't scale because Y / is error-prone because Z].

In this guide, we'll solve this by [brief preview of the library's approach].
```

**Guidelines for this section:**
- Keep it to 1-2 short paragraphs plus an optional code example. Do not over-explain.
- **The "before" example is `mdoc:compile-only` by default, not plain `scala`.** What a reader writes
  today is ordinarily verbose *working* code — hand-rolled boilerplate, a repeated pattern, a manual
  match over every case. The pain is the volume, not a compile error, so there's usually no error to
  dodge and nothing about the block a reader has to take on faith. Reserve a plain ` ```scala ` fence
  (no mdoc) for the rarer case where the problem is genuinely architectural and no runnable snippet
  shows it — prefer a concrete scenario description there instead: "Imagine you have 40 case classes
  representing your API schema and you need to keep JSON codecs, database mappings, and OpenAPI specs
  in sync."
- **Never use the library being documented in this block.** A "before" that already uses the library
  being taught is not a before — it has no contrast in it. And an uncompiled block naming a real
  method from the library is the one place a wrong signature could sit in a finished page uncaught.
- **Never rewrite the "before" into idiomatic code.** Its verbosity is the section's entire argument —
  if it looks fine as written, either the problem isn't real or the wrong example was picked.
- The problem section naturally sets up the rest of the guide. The reader should finish this section thinking "yes, I have this exact problem" and be motivated to read on.

#### Prerequisites

A short section listing:
- **sbt dependency** (the `libraryDependencies` line)
- **Base imports** that will be used throughout (put in an `mdoc:silent` block so subsequent blocks can use them)
- **Assumed knowledge** — what the reader should already know (link to relevant reference pages)

#### Core Model / Domain Setup

Define the domain types the guide will use. Use an `mdoc:silent` block so subsequent sections can reference these types:

```scala mdoc:silent
case class User(name: String, email: String, age: Int)
case class Order(id: Long, userId: Long, items: List[Item])
case class Item(name: String, price: Double, quantity: Int)
```

Briefly explain why you chose these types and how they relate to the goal.

#### Capability Sections (one per step — but never title them that)

**Name each heading for the capability it delivers, in the reader's words** — never a generic step
label: ✅ `## Validating Incoming Records` ❌ `## Step 2` ❌ `## Capability Section 2`. No heading in
the whole guide may contain this template's own vocabulary — "Step", "Capability", "Section",
"Concept" — or a leading ordinal it supplied. Those are planning labels for you, not for the reader.

For each section:

1. **Lead with 1-3 sentences** explaining what we're doing and why.
2. **Show the code** in an appropriate mdoc block.
3. **Show the result** — if the code produces output, use `mdoc` (not `mdoc:compile-only`) to show the evaluated result. If it's a type-level or structural result, add a comment showing what was created.
4. **Add a brief "what happened" explanation** if the code does something non-obvious.
5. **Use admonitions** for tips, warnings, or gotchas:

```
:::tip
This pattern also works for [related use case].
:::

:::warning
Do not [common mistake] — it will [bad consequence].
:::
```

#### Putting It Together

Near the end, show the complete working example that combines everything from the guide. **This is
not an inline code block.** It is an EMPTY block fenced `` scala mdoc:embed:<path-to-CompleteExample.scala> ``
(or the project's `SourceFile.print` equivalent — see `docs-examples`) pointing at the companion
`CompleteExample.scala` that Step 4 builds. Never soften this to "may include an embedded example" or
write the code inline instead: the embedded file is what the examples build actually compiles, so
inlining ships code no build has verified as standalone — and Step 4 then has nothing to build, since
nothing in the page names a file for it to create.

#### Running the Examples

Follow the **"Running the Examples" section template** from the `docs-examples` skill. It provides the exact Markdown pattern to use in your guide, substituting the correct `<packagename>` and example object names.

Two details specific to this guide's needs:
- Clone and `cd` in one path straight into the examples module directory — `cd <repo>/<examples-module>`, not a separate `cd <repo>` followed by a separate `cd <examples-module>`.
- Embed each step's file, in order, the same way "Putting It Together" does: a collapsible `<details><summary>` wrapping `` scala mdoc:embed:<path>:show-line-numbers ``, a short sentence on how to run it, and its `sbt "<examples-module>/runMain ..."` command.

#### Going Further (Optional)

If relevant, end with:
- Links to related reference pages for deeper API coverage
- Variations or extensions the reader might try
- Links to other guides that build on this one

**Check every target page exists before linking to it.** Mention a page in prose, unlinked, when it
doesn't exist yet — never a placeholder to be resolved later, and never accept a stub page written
just to make one resolve.

### Writing Style Rules

See the **`docs-writing-style`** skill for universal prose style, Scala version rules, and code
block conventions.

### Compile-Checked Code Blocks with mdoc

See the **`docs-mdoc-conventions`** skill for the complete mdoc modifier table, key rules, and
the "For How-To Guides (Progressive Narrative)" section which explains the recommended modifier
sequence for guides specifically.

### Docusaurus Admonitions

See the **`docs-mdoc-conventions`** skill for admonition syntax and usage guidelines.

---

## Step 4: Create Companion Examples

**Every how-to guide has them — this step is never optional.** "Putting It Together" and each step in
"Running the Examples" are `mdoc:embed` blocks (Step 3), not inline code, so those embeds have nothing
to resolve to until this step runs. If you find yourself skipping this step because the guide "doesn't
need it," that means Step 3 was written wrong — go back and fix the page to embed, then build the
files here.

Use the **`docs-companion-examples`** skill to commission and verify companion examples — it delegates
the build (directory structure, file templates, compilation, lint) and checks what came back.

---

## Step 5: Verify Mdoc Compilation

Before integrating, verify that all code examples in the guide compile — scoped to this file, never
unscoped (`sbt docs/mdoc` alone recompiles all documentation, ~90 seconds):

```bash
sbt "docs/mdoc --in docs/guides/<guide-name>.md --out website/docs/guides/<guide-name>.md"
```

`--out` is the same path prefixed with `website/`. Fix any compilation errors before proceeding.

---

## Step 6: Fact-Check

**Same reason as `docs-data-type-ref`'s fact-check step**: nothing before this step verifies the
guide's prose claims about the library against real source — only that the code compiles. A step that
names a method the library doesn't have, or describes behavior the source contradicts, sends the
reader down a dead end at exactly the point they're trying to get something done.

Delegate to the **`docs-fact-checker`** agent with the `Task` tool:

```
Task(
  description: "Fact-check <guide-id> how-to guide",
  subagent_type: "documentation:docs-fact-checker",
  prompt: "Page: docs/guides/<guide-id>.md
           Subject: <topic>
           Library source root: <path>"
)
```

Fix every reported drift by correcting the **guide**, never the source. Bounded rounds, same
discipline: fix everything a check reports, then confirm once — that confirming round is what records
the guide as clean. Genuinely new drifts in a confirming round earn another, up to 3 total; a round
repeating the same drifts ends it.

---

## Step 7: Integrate

Delegate to the **`docs-integrator`** agent with the `Task` tool:

```
Task(
  description: "Integrate <guide-id> how-to guide",
  subagent_type: "documentation:docs-integrator",
  prompt: "Page: docs/guides/<guide-id>.md
           Category: Guides (create it if absent)
           Cross-reference direction: add 'See also' links from related reference pages that already
           exist (e.g. if this guide uses Schema, from docs/reference/schema.md) — check first, and
           name which do. Never ask for a reference page to be created to satisfy a link, and never
           accept a stub written to make one resolve."
)
```

---

## Step 8: Final Review

Delegate to the **`docs-reviewer`** agent with the `Task` tool: give it [CHECKLIST.md](./CHECKLIST.md)'s
content and have it evaluate the guide against every item.

```
Task(
  description: "Review <guide-id> how-to guide",
  subagent_type: "documentation:docs-reviewer",
  prompt: "Evaluate docs/guides/<guide-id>.md against this checklist: <CHECKLIST.md's content>"
)
```

**Bounded rounds:** if review reports failing items, fix them ALL and call it once more — that
confirming round is what records the guide as passing, since the verdict is whatever the last review
found. Genuinely NEW failing items in a confirming round earn another round, up to 3 total; a round
repeating the same failures ends it — name what's still failing in your summary. A review that
reported nothing needs no confirming round.
