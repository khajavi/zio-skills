---
name: docs-tutorial
description: Write a tutorial for newcomers learning a topic in a ZIO library. Tutorials teach concepts step-by-step in a linear path for learning-oriented, not task-oriented, purposes. Use when writing comprehensive learning guides.
allowed_tools: Read, Glob, Grep, Bash
---

# Tutorial: Conceptual Overview

A tutorial is **learning-oriented** — it builds mental models for newcomers encountering a topic for the first time. It is not a reference page (exhaustive API) or how-to guide (task completion).

## Core Properties

- **Targets newcomers**: assume no prior knowledge of the topic
- **Linear path**: no branching, no "alternatively" — one path, followed to completion
- **One concept per section**: each section introduces exactly one new idea
- **Annotated code**: every code block followed by line-by-line bullet explanation
- **Intermediate output**: show results after meaningful steps so learner can verify progress
- **Warm tone**: "Welcome", "Let's", "notice that", "try changing X to see Y"
- **Present tense**: "we learn", "we see", "we observe"
- **Recap at end**: "What You've Learned" mirrors the opening learning objectives

## 7-Section Structure

1. **Introduction** — who it's for, learning objectives, section outline
2. **Background / Big Picture** (optional) — conceptual framing, no code
3. **Concept sections** (3–6) — one concept each, code + annotation + output
4. **Putting It Together** — complete runnable example combining all concepts
5. **Running the Examples** — one `###` per example: narrative, embedded source, observe note, run command
6. **What You've Learned** — bullet recap mirroring learning objectives
7. **Where to Go Next** — links to how-to guides and reference pages

## Quality Gate

Before submitting, work through **[CHECKLIST.md](./CHECKLIST.md)** — 38 items across Content Quality, Technical Accuracy, Companion Examples, Running the Examples, and Style and Integration.
