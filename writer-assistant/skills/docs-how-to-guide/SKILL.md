---
name: docs-how-to-guide
description: Write a how-to guide for practitioners accomplishing a specific task with a ZIO library. Guides are goal-oriented and task-focused, not pedagogical. Use when writing step-by-step practical guides.
allowed_tools: Read, Glob, Grep, Bash
---

# How-To Guide: Conceptual Overview

A how-to guide is **goal-oriented** — it helps practitioners accomplish a specific task. It is not a tutorial (building a mental model for newcomers) or a reference page (exhaustive API docs). The reader already knows the library basics and wants to get something done.

## Core Properties

- **Goal-focused**: reader wants to accomplish a concrete task, not learn concepts
- **Assumes familiarity**: skip conceptual preambles; introduce types and APIs only as needed
- **Direct and imperative**: "Define a Schema", "Create a codec", "Run the effect" — not "Let's explore"
- **Realistic examples**: close to production use, not toy snippets
- **Shows intermediate results**: printed output or types after major steps so reader can verify progress
- **No branching**: pick the canonical path; don't offer alternatives inline

## 8-Section Structure

1. **Introduction** — 1 paragraph: what the reader will accomplish, why useful, approach in one sentence
2. **The Problem** — concrete problem statement + why it matters + "before" code showing the pain point
3. **Prerequisites** — sbt dependency, base imports in `mdoc:silent`, assumed knowledge
4. **The Core Model** — domain types in `mdoc:silent`, brief explanation of design choices
5. **Step-by-step sections** (3–6) — one new concept each: 1–3 sentence intro → code → result. When companion examples are requested, each section's code block stays an inline `mdoc` block (auto-rendered output is required here — `mdoc:embed` cannot show it), but the corresponding companion `.scala` file must copy that code **verbatim**, not re-derive it from the prose.
6. **Putting It Together** — complete copy-paste runnable example combining all steps. When companion examples are requested, do not paste this code inline — write it directly to `CompleteExample.scala` and embed it with `mdoc:embed` (output rendering isn't needed here, so embedding the file directly eliminates the duplication entirely).
7. **Running the Examples** — git clone + sbt runMain per example. `CompleteExample.scala` is already embedded in "Putting It Together" — do not embed its source a second time here; give it narrative + observe note + run command only.
8. **Going Further** (optional) — links to reference pages, related guides, variations
