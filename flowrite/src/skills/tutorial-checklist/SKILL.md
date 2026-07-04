---
name: tutorial-checklist
description: The review checklist a ZIO tutorial must pass before it is considered done. Load when reviewing a finished tutorial for content, technical accuracy, examples, and integration.
---

# Tutorial Review Checklist

Verify every item. The tutorial is not done until all pass.

## Content Quality

- States who it is for (newcomer, assumed prior knowledge).
- Learning objectives stated upfront as a bullet list.
- Learning objectives restated at the end in "What You've Learned".
- Follows a strict linear path (no branching, no "alternatively").
- Every section introduces exactly one new concept or builds incrementally.
- No section is pure prose without a code example.
- Every code example is annotated line-by-line with bullet-point explanations.
- Intermediate results are shown (printed or observed) after each major step.
- The running example is simple and clearly demonstrates the core concepts.
- Types and APIs are introduced only as needed (no front-loaded theory).
- Warm, welcoming tone ("welcome", "let's", "notice that").
- "Putting It Together" is a complete, self-contained, copy-paste-ready example.
- A "Background" section, if present, explains motivation without code.

## Technical Accuracy

- All method signatures and type names match the actual source code.
- All code examples use correct mdoc modifiers and would compile.
- Imports are complete and correct in every code block.
- The sbt dependency (if mentioned) is correct and uses `@VERSION@`.
- No deprecated methods or outdated patterns.
- `sbt "docs/mdoc --in docs/guides/<id>.md"` reports zero `[error]` lines (mandatory before done).

## Companion Examples

- A package directory exists under the `<library>-examples` module.
- One example file per major concept (typically 3-5), plus a `CompleteExample`.
- Each example file is self-contained, compiles and runs independently, with complete imports.
- Each file has a scaladoc with tutorial title, concept name, description, and `sbt runMain` command.
- Each file prints meaningful output.
- All examples compile (`sbt "<module>/compile"`).

## Running the Examples Section

- Present after "Putting It Together".
- Includes `git clone https://github.com/zio/<repo>.git` and `cd <repo>`.
- Lists every example object with its `sbt "<module>/runMain ..."` command.
- Includes `sbt "<module>/compile"` as an alternative.

## Style and Integration

- Frontmatter `id` matches the filename.
- The tutorial is in `docs/guides/` (with the how-to guides).
- Added to `sidebars.js` under the "Guides" category.
- Linked from `docs/index.md`.
- Related reference pages link back to this tutorial.
- Writing style followed (warm tone, present tense, "we"/"you", concise, no emojis).
- Admonitions used sparingly, only for genuinely important callouts.
