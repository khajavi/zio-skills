---
name: docs-tutorial
description: Write a tutorial for newcomers learning a topic in a ZIO library. Use when the user asks to write a tutorial or learning guide that teaches concepts step-by-step in a linear path. Tutorials are learning-oriented (for newcomers with no prior knowledge) unlike how-to guides which are task-oriented.
argument-hint: "[tutorial title or topic description]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(sbt:*), Bash(sbt gh-query*), Bash(git:*), Task, Skill
---

# Write a Tutorial

Write a comprehensive, learning-oriented tutorial for newcomers to the ZIO library being documented.

## Tutorial Topic

<!-- $ARGUMENTS is the slash-command argument the user passed (see argument-hint
     in the frontmatter). Claude Code substitutes the user's input here at
     invocation time. -->

$ARGUMENTS

If no topic appears above (or the literal text `$ARGUMENTS` is shown), ask the user what tutorial they want to write before proceeding. Do not invent a topic.

## Overview: What Makes a Good Tutorial

A tutorial is **learning-oriented** — it teaches concepts and builds mental models for newcomers encountering a topic for the first time. It is neither a reference page (which documents an API exhaustively) nor a how-to guide (which helps practitioners accomplish a specific task). A tutorial assumes the reader has no prior knowledge and follows a linear, carefully controlled learning path.

Key properties of a good tutorial:

- **Targets newcomers**: The reader is encountering this topic for the first time. Assume nothing.
- **Teaches concepts, not tasks**: The goal is understanding, not accomplishing a specific thing yet.
- **Linear path**: No branching ("if you need X, do Y instead"). Pick one path and follow it.
- **Minimal, annotated code**: Code demonstrates concepts; it is not production-ready. Every code example is annotated line-by-line.
- **Learning objectives stated upfront**: The reader knows what they will understand by the end.
- **Intermediate output**: After each step, show results so the learner can verify they're on track.
- **Warm, welcoming tone**: Use "Welcome", "Let's", "notice that", "try changing X to see Y".
- **Recap at the end**: "What You've Learned" restates objectives as completed achievements.

---

## Step 1: Deep Research — Understand the Topic Landscape

Before writing a single word, you must build a complete mental model of every type, method, pattern, and concept relevant to the tutorial topic. This is the most critical step.

Delegate to the **`docs-researcher`** agent with the `Task` tool — it must NOT share your
conversation, so its only knowledge of what to research is what you tell it:

```
Task(
  description: "Research <topic> for a tutorial",
  subagent_type: "documentation:docs-researcher",
  prompt: "Research <topic> for a learning-oriented tutorial. Find: the ONE core concept or skill this
           tutorial teaches; prerequisite knowledge the learner must already have; for each core type,
           what it is and its role in learning this concept; the dependency/composition order (first
           understand X, then how Y builds on X, then combine with Z); factory methods and constructors
           the learner will actually use; the simplest possible starting point and the layers of
           complexity that can be added incrementally; a candidate 'aha moment'; imports and sbt
           dependency; commit history for why this is shaped the way it is."
)
```

Read its findings before proceeding — if they're missing or thin, say so and delegate again rather
than filling the gap yourself.

### 1e. Answer These Research Questions

Before proceeding to writing, you must be able to answer every one of these questions. Write the answers down (internally) as they will directly inform the tutorial structure:

**About the learning goals:**

1. What is the ONE core concept or skill this tutorial teaches?
2. What prerequisite knowledge must the learner already have? (e.g., "basic Scala syntax", "understanding of case classes")
3. What will the learner be able to do after completing this tutorial?
4. What mental model or conceptual framework will the learner have?

**About the types involved:**

5. For each core type: What is it, in one sentence? What role does it play in learning this concept?
6. What is the dependency/composition order? (e.g., "First understand X, then understand how Y builds on X, then combine them with Z")
7. Which factory methods and constructors will the learner actually use?
8. What type class instances are derived automatically vs. must be created manually?

**About the narrative arc:**

9. What is the simplest possible starting point? (The "hello world" for this concept)
10. What layers of complexity can be added incrementally? (e.g., start with a flat structure, then add nesting, then add variation)
11. Where should you pause to show intermediate results? (e.g., print output, display a value, demonstrate behavior)
12. What is the natural ending point — the "complete" version?
13. What is one key "aha moment" you want the learner to have?

**About the ecosystem:**

14. What imports does the learner need?
15. What sbt dependencies are required?
16. Are there Scala 2 vs. Scala 3 differences the learner should know about?
17. Does this integrate with other ZIO libraries (ZIO HTTP, ZIO Streams, etc.)?

---

## Step 2: Design the Tutorial Structure

Based on your research answers, design the tutorial's section structure before writing. A tutorial follows this general skeleton:

### Structural Template

```
1. Introduction
   - Who this is for (newcomer with no prior knowledge)
   - Learning objectives (bullet list)
   - Overview of what the tutorial covers (brief outline)
   - "We recommend reading from top to bottom"

2. Background / The Big Picture (optional, 1-2 paragraphs)
   - Conceptual framing: what problem this API was designed to solve
   - No code — just mental model

3. Concept sections (3-6 sections, each one new idea)
   - Explanation of the concept (1-3 sentences)
   - Minimal working code block (annotated line-by-line)
   - Output or result showing it worked
   - Runnable block (when `docs-examples` calls for one)
   - No branching, no "alternatively"

4. Putting It Together (only for page shape `one-program`)
   - What the program does and how it differs from the sections
   - Embed of CompleteExample.scala

5. Running the Examples
   - A short pointer to the examples folder

6. What You've Learned
   - Bullet-point recap of each learning objective

7. Where to Go Next
   - Links to how-to guides (for applying the knowledge in practice)
   - Links to reference pages (for API depth)
```

Record the page shape — `one-program` (the usual case for a tutorial) or `recipes` — in the plan
(definitions: `docs-examples`, "The Complete Example").

### Section Design Rules

- **Linear progression**: No branching. Never say "if you need X, do Y instead". Pick one path.
- **One concept per section**: Each section introduces exactly one new idea or builds incrementally on previous sections.
- **Concept before code**: Always explain what the code will do and why before showing it.
- **Every section has code**: No pure-prose sections. Every concept is demonstrated with code.
- **Line-by-line annotation**: Every code block is followed by a bullet-point breakdown explaining each line or block of lines. When a block has only one or two meaningful lines, annotate it in one prose sentence instead — `docs-writing-style` rule 21 forbids one- or two-item bullet lists, and reviewers flag both directions. When several sections repeat the same pattern (e.g. one format per section), keep the bullets short and parallel rather than dropping them.
- **Show intermediate output**: After meaningful steps, show or print results so the learner can verify they're on track.
- **Limit scope aggressively**: A tutorial about "understanding Scope" should not become "everything you can do with Scope". Stay on the learning objective.

### Narrative Planning

Plan the tutorial arc:

1. **Choose a relatable domain**: Pick something the learner can understand without domain expertise (e.g., "a simple configuration system", "managing a resource").
2. **Start with the simplest example**: Something that can be explained in 3-4 lines and demonstrates the core concept.
3. **Build incrementally**: Each subsequent section adds one layer of complexity or introduces one supporting concept.
4. **Plan the "show moments"**: Points where you print, observe, or demonstrate behavior. These are crucial for learner confidence.

---

## Step 3: Write the Tutorial

### File Location and Frontmatter

Place the file in `docs/guides/` directory (same location as how-to guides):

```
---
id: <kebab-case-id>
title: "<Tutorial Title>"
description: "A 50-150 character summary of what this tutorial teaches."
keywords:
  - "General Domain Concept"
  - "Page-Specific Concept"
  - "<Core Type Name>"
---
```

`description` and each `keywords` entry are double-quoted; `keywords` is a block list (one `- "item"`
per line), 3-6 entries. Write these now — don't rely on a later docs-backfill-metadata pass.

The `id` must match the filename (without `.md`), and must be specific to this tutorial's actual
angle: `compositional-fiberref-updates`, not `fiberref`. A vague id invites the next tutorial about the
same type to collide with it, or to be titled just as vaguely.

### Writing the Sections

**Section Heading Format:** Use numbered section headings (e.g., "## 1. Topic Name", "## 2. Next Topic") instead of wordy descriptors. This makes sections scannable and progress clear to the learner.

#### Introduction

Start with a welcome and clear statement of who this tutorial is for:

```
Welcome to [Tutorial Title]! This tutorial is for [target learner] who [assumed prior knowledge]. You don't need any prior experience with [topic] to follow along.
```

Immediately follow with **Learning Objectives** — a concise bulleted list (3–5 bullets max) of what the learner will understand by the end, plus a brief outline of section titles:

```
## Learning Objectives

By the end of this tutorial, you will understand:

- What [concept A] is and why it matters
- How to [do task B] with [API C]
- The relationship between [concept D] and [concept E]

We'll learn these concepts through:

1. [Section Title]
2. [Section Title]
3. [Section Title]

We recommend reading from top to bottom.
```

**Pattern:**

```
Welcome to [Topic]! This tutorial is designed for newcomers who [assumed prior knowledge — be specific].

## Learning Objectives

By the end, you will understand:
- [objective 1]
- [objective 2]
- [objective 3]

We'll learn these concepts through:

1. [Introduction to core concept]
2. [Building on concept: variation 1]
3. [Building on concept: variation 2]
...

We recommend reading from top to bottom — each section builds on the previous one.
```

#### Background / The Big Picture (Optional)

If helpful, include 1-2 paragraphs that frame the conceptual motivation:

- What problem was this API designed to solve?
- What is the big mental model?
- Why does this matter?

**Important**: No code in this section. This is pure conceptual framing.

**Pattern:**

```
## Background

[1-2 paragraphs explaining the conceptual motivation, the problem this type solves, or the mental model you should have. No code.]
```

#### Concept Sections (3-6 sections, 1 new concept per section)

For each concept section:

1. **Lead with 1-3 sentences** explaining the concept and why it matters.
2. **Show minimal, annotated code** in an appropriate mdoc block.
3. **Annotate the code line-by-line** with bullet points immediately after the code block:

```
​```scala mdoc
val x = foo()  // create something
println(x)
​```

The code above:
- `foo()` — creates [what]
- `println(x)` — prints the result to see what was created
```

4. **Show the result** — if the code produces output, use `mdoc` (not `mdoc:compile-only`) to show evaluated output. When a code block's output is important for understanding, always display the actual output after the code block (prefaced with "Output:" or similar).

5. **Add a brief explanation** if the result is non-obvious.

6. **Use Docusaurus admonitions** for important notes and insights:

```
:::note
[Important observation that the learner should remember.]
:::

:::tip
[Practical guidance or a useful pattern.]
:::

:::caution
[Something to watch out for or a common mistake.]
:::
```

7. **Provide copy-pasteable code** whenever possible. If code is intentionally incomplete or demonstrates an error:
   - Use clear prose descriptions instead of misleading comments like `// ERROR: ...`
   - If showing a compile failure, provide actual compilable code or state explicitly that the code does not compile
   - Never use pseudo-code with fake error messages

8. **Never branch**: Do not write "alternatively, you could..." or "if you need X, use Y instead". Pick one approach and follow it.

#### Putting It Together

Only for page shape `one-program`. A brief explanation — "This example combines all the concepts
we've learned — [quick summary]" — naming every way it differs from the sections, then an EMPTY block
fenced `` scala mdoc:embed:<path-to-CompleteExample.scala> `` (or the project's `SourceFile.print`
equivalent — see `docs-examples`).

#### Runnable Blocks in Concept Sections

A concept section gets a collapsible runnable block only when `docs-examples` "Embedding in the
Page" calls for one — never for a file that only wraps the section's snippet. The block ends its
section; never collect blocks in a separate section.

#### Running the Examples

The short pointer from `docs-examples` "Embedding in the Page" — no re-embedded code.

#### What You've Learned

Recap what the learner accomplished. Mirror the "Learning Objectives" section from the introduction, but restate them as achievements:

```
## What You've Learned

In this tutorial, you learned:

- What [concept A] is and why it matters
- How to [do task B] with [API C]
- The relationship between [concept D] and [concept E]
- How to [construct/use] [type F]

You now have a solid foundation in [topic]. The next step is to see how to [apply this in practice].
```

#### Where to Go Next

Provide links to help the learner deepen their knowledge. **Check each target page exists before
linking to it.** Mention a guide or reference page in prose, unlinked, when it doesn't exist yet —
never a placeholder link to be resolved later, and never accept a stub page written just to make one
resolve. A tutorial run writes a tutorial, not a reference page it happens to link to.

```
## Where to Go Next

- **Ready to use this in practice?** Check out the how-to guide [Guide Name](../guides/guide-name.md) which walks through a real-world example.
- **Want to dive deeper into the API?** Read the reference page for [`TypeName`](../reference/type-name.md).
- **Interested in related concepts?** Explore [Related Topic](./related-topic.md).
```

### Writing Style Rules

See the **`docs-writing-style`** skill for universal prose style, Scala version rules, and code block conventions.

**Additional style notes for tutorials:**

- Use warm, welcoming language: "Welcome", "Let's", "Notice that", "Try changing X to see what happens"
- Use present tense: "we learn", "we see", "we observe"
- Address the learner directly: "you now understand", "you can now do"
- Keep explanations brief and clear — a tutorial is about understanding, not about exhaustively covering every detail

### Compile-Checked Code Blocks with mdoc

See the **`docs-mdoc-conventions`** skill for the complete mdoc modifier table, key rules, and the "For Tutorials (Linear Learning Path)" section (or equivalent) which explains the recommended modifier sequence for tutorials specifically.

### Docusaurus Admonitions

See the **`docs-mdoc-conventions`** skill for admonition syntax and usage guidelines.

---

## Step 4: Create Companion Examples

Every runnable block and "Putting It Together" embed written in Step 3 names a file this step builds.
A tutorial always has runnable code, so this step always runs.

Use the **`docs-companion-examples`** skill to commission and verify companion examples, passing the
page shape from Step 2.

**Browser-side behaviour needs a browser check.** When a tutorial's claims happen in the browser
(htmx, Datastar, any JS library the page loads), mdoc and `sbt run` only prove the server half. Pin
the JS library to an exact CDN version, read its real dist file for the behaviour you describe, and
run the server example against headless Chromium (Playwright: type, select, reload, Back; log the
request URLs and headers). Seen in zio-blocks T-10: this caught that htmx 2 sends `HX-Request: true`
on a history-restore cache miss, so "fragment whenever HX-Request" breaks the Back button. Server
examples that keep running for a browser can be verified with `timeout N java -cp <classpath from
sbt "export Runtime / fullClasspath"> <main> <port>` plus `curl`, without killing sbt.

---

## Step 5: Verify Mdoc Compilation

Before integrating, verify that all code examples in the tutorial compile — scoped to this file, never
unscoped (`sbt docs/mdoc` alone recompiles all documentation, ~90 seconds):

```bash
sbt "docs/mdoc --in docs/guides/<tutorial-name>.md --out website/docs/guides/<tutorial-name>.md"
```

`--out` is the same path prefixed with `website/`. Fix any compilation errors before proceeding.

---

## Step 6: Fact-Check

**Same reason as `docs-data-type-ref`'s fact-check step**: a tutorial's prose is looser than a
reference page's, but its claims about the library are not. A step that names a method the library
doesn't have, or describes behavior the source contradicts, sends a learner nowhere — and nothing
before this step verifies tutorial prose against real source; mdoc only verified that the code
compiles, not that the surrounding claims about it are true.

Delegate to the **`docs-reviewer`** agent with the `Task` tool, asking it to fact-check (the agent
covers both a full-page checklist/style review and a fact-check — say plainly which this call is):

```
Task(
  description: "Fact-check <tutorial-id> tutorial",
  subagent_type: "documentation:docs-reviewer",
  prompt: "Fact-check this page against source (not a checklist/style review).
           Page: docs/guides/<tutorial-id>.md
           Subject: <topic>
           Library source root: <path>"
)
```

It reports each drift with the exact corrected statement, not just a description of what's wrong.
Never fix a drift yourself: delegate every reported drift, verbatim (its exact statement included), to
the **`docs-fixer`** agent with the `Task` tool — correcting only the **tutorial**, never the source:

```
Task(
  description: "Apply fact-check fixes to <tutorial-id> tutorial",
  subagent_type: "documentation:docs-fixer",
  prompt: "Page: docs/guides/<tutorial-id>.md
           Findings (apply each verbatim):
           <every drift from the fact-check reply, its exact statement included>"
)
```

Bounded rounds, same discipline: after `docs-fixer` returns, re-run mdoc, then delegate the same
fact-check to `docs-reviewer` once more — that confirming round is what records the tutorial as
clean. Genuinely new drifts in a confirming round earn another (delegate those to `docs-fixer` too),
up to 3 total; a round repeating the same drifts ends it.

---

## Step 7: Integrate

Delegate to the **`docs-integrator`** agent with the `Task` tool:

```
Task(
  description: "Integrate <tutorial-id> tutorial",
  subagent_type: "documentation:docs-integrator",
  prompt: "Page: docs/guides/<tutorial-id>.md
           Category: Guides
           Also add the tutorial to every guide list in docs/index.md (CHECKLIST.md requires it;
           in zio-blocks there are two: the module section and the full guides list), and a
           forward link from the prerequisite tutorial's 'Where to Go Next'.
           Cross-reference direction: add 'See also' links from related reference pages that already
           exist (e.g. if this tutorial teaches Scope, from docs/reference/scope.md) — check first, and
           name which do. Never ask for a reference page to be created to satisfy a link, and never
           accept a stub written to make one resolve."
)
```

Tutorials should also link to related how-to guides in the "Where to Go Next" section (Step 3) to
guide learners toward practical application — that's page content, not something to ask the agent for.

---

## Step 8: Final Review

Delegate to the **`docs-reviewer`** agent with the `Task` tool, asking for a full-page review: give
it [CHECKLIST.md](./CHECKLIST.md)'s content, have it evaluate the tutorial against every item, and
tell it to give the exact corrected statement for every failing item, not just what's wrong.

```
Task(
  description: "Review <tutorial-id> tutorial",
  subagent_type: "documentation:docs-reviewer",
  prompt: "Full-page review (not a fact-check): evaluate docs/guides/<tutorial-id>.md against this
           checklist: <CHECKLIST.md's content, with the docs-examples "Checklist" items pasted in place of its pointer>
           For every failing item, give the exact corrected statement to apply."
)
```

Never fix a failing item yourself: delegate everything review reports, verbatim (the exact statement
for each), to the **`docs-fixer`** agent with the `Task` tool:

```
Task(
  description: "Apply review fixes to <tutorial-id> tutorial",
  subagent_type: "documentation:docs-fixer",
  prompt: "Page: docs/guides/<tutorial-id>.md
           Findings (apply each verbatim):
           <every failing item from the review reply, its exact statement included>"
)
```

**Bounded rounds:** after `docs-fixer` returns, re-run mdoc, then delegate the same review to
`docs-reviewer` once more — that confirming round is what records the tutorial as passing, since the
verdict is whatever the last review found. Genuinely NEW failing items in a confirming round earn
another round (delegate those to `docs-fixer` too), up to 3 total; a round repeating the same
failures ends it — name what's still failing in your summary. A review that reported nothing needs no
confirming round.
