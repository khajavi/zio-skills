---
name: tutorial-structure
description: The section template, section-design rules, and narrative-planning method for learning-oriented ZIO tutorials. Load when designing a tutorial's structure before writing.
---

# Tutorial Structure

Design the section structure before writing a word. A tutorial is learning-oriented: it teaches concepts and builds mental models for a newcomer, following one linear path.

## Structural Template

```
1. Introduction
   - Who this is for (newcomer, no prior knowledge)
   - Learning objectives (3-5 bullets)
   - Brief outline of the sections
   - "We recommend reading from top to bottom"
2. Background / The Big Picture (optional, 1-2 paragraphs, NO code)
   - What problem the API was designed to solve; the mental model
3. Concept sections (3-6, one new idea each)
   - 1-3 sentences explaining the concept
   - Minimal annotated code block
   - Output/result showing it worked
   - No branching, no "alternatively"
4. Putting It Together
   - The complete runnable example combining all concepts
5. Running the Examples
   - git clone, then one `cd` straight into the examples module dir in a single
     path (e.g. `cd <repo>/<library>-examples`, not a separate `cd <repo>` and
     `cd <library>-examples`)
   - Per concept, in order: a collapsible `<details><summary>` embedding that
     example's source via `mdoc:embed:<path>:show-line-numbers` (same pattern
     as Putting It Together); a short sentence on how to run it; its
     `sbt "<id>/runMain ..."` command
6. What You've Learned
   - Objectives restated as achievements
7. Where to Go Next
   - Links to how-to guides and reference pages
```

## Section Design Rules

- **Linear progression**: No branching. Never "if you need X, do Y instead". Pick one path.
- **One concept per section**: Each section introduces exactly one new idea or builds incrementally.
- **Concept before code**: Explain what the code does and why before showing it.
- **Every section has code**: No pure-prose sections.
- **Line-by-line annotation**: Follow every code block with a bullet breakdown of each line or block of lines.
- **Show intermediate output**: After meaningful steps, show results so the learner can verify.
- **Limit scope aggressively**: A tutorial on "understanding Scope" is not "everything you can do with Scope". Stay on the objective.
- **Numbered headings**: Use "## 1. Topic", "## 2. Next Topic" so progress is scannable.

## Narrative Planning

1. **Choose a relatable domain** the learner understands without expertise (a simple config system, managing a resource).
2. **Start with the simplest example** — 3-4 lines that demonstrate the core concept.
3. **Build incrementally** — each section adds one layer of complexity or one supporting concept.
4. **Plan the verifiable outputs** — points where printed or observed output lets the learner confirm the code behaved as claimed.
5. **Name the core insight** — the single realization the whole tutorial drives the learner toward.
