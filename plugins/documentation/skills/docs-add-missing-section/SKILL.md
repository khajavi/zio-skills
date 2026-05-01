---
name: docs-add-missing-section
description: >
  Add a missing section to an existing data type reference page. Use when a required section
  (such as "Construction", "Predefined Instances", "Comparison", or "Advanced Usage") is
  entirely absent from an existing docs/reference/*.md file. The user provides the doc path
  and a description of what section is needed and why.
argument-hint: "[path/to/reference-doc.md] [description of missing section and why it is needed]"
allowed-tools: Read, Glob, Grep, Bash(sbt:*), Bash(sbt gh-query*), Skill
---

# Add a Missing Section to a Reference Page

**REQUIRED BACKGROUND:** Use `docs-writing-style` for prose conventions and `docs-mdoc-conventions` for code block syntax throughout.

## Overview

Data type reference pages follow a canonical structure (see below). When a section is entirely missing — not just thin, but absent — this skill inserts it at the correct position with full, publication-ready content.

### Canonical Section Ordering

Reference pages follow this sequence:

1. **Opening Definition** (no `##`, directly after frontmatter)
2. **Motivation / Use Case** (if applicable)
3. **Installation** (if applicable; top-level types only)
4. **Construction / Creating Instances** (required)
5. **Predefined Instances** (if applicable)
6. **Core Operations** (required)
7. **Subtypes / Variants** (if applicable)
8. **Comparison** (if applicable; always after Core Operations)
9. **Advanced Usage** (if applicable)
10. **Integration** (if applicable)
11. **Running the Examples** (if applicable)

---

## Step 1 — Read and Map the Existing Document

Read the full target file. For each `##` heading:
- Record the heading text and line number
- Map it to the canonical ordering above

Identify the gap: where should the new section appear?
- Find the last `##` heading that appears *before* the new section's position (the insertion point's predecessor)
- Find the first `##` heading that appears *after* the new section's position (the insertion point's successor)
- Note the line range where the new section will be inserted

Record the document's tone, example style, heading naming conventions, and code block style (these inform your writing).

---

## Step 2 — Research the Missing Section Content

Delegate baseline research to the `docs-research` sub-skill using the `/docs-research` command. It covers:
- Core source files
- Supporting types
- Real-world patterns
- GitHub history

**Then apply section-specific research supplements:**

### For *Construction* sections:
- Grep the source file for all public factory methods (`apply`, `empty`, `from*`, `of`, `derived`, etc.)
- Grep test files for construction patterns and edge cases
- Check the companion object thoroughly for all static factory methods

### For *Predefined Instances* sections:
- Grep the source file for `val.*: <TypeName>` patterns (both in the type itself and companion object)
- Check for implicit instances in companion objects
- Search examples for which predefined instances are used most often

### For *Comparison* sections:
- Identify the closest 2–5 alternatives (sibling types, similar APIs, competing designs)
- For each alternative, research: mutability model, performance characteristics, API surface, typical use cases
- Build a mental model of the dimensions on which they differ (e.g., laziness, performance, API breadth, immutability guarantees)

### For *Advanced Usage* sections:
- Glob `**/examples/**/*.scala` for non-trivial patterns combining this type with others
- Search test suites for integration patterns, composition tricks, or non-obvious behaviors
- Check GitHub issues for "how do I..." questions indicating real-world advanced usage

### For *Motivation* sections:
- Search GitHub history for issues titled "Why use X?" or "X vs Y"
- Find the first commit introducing the type — read the commit message
- Trace the design rationale via related discussions

---

## Step 3 — Determine the Correct Insertion Point

Match the section type to its canonical position from Step 1:

| If you are adding... | Canonical position |
|---|---|
| Motivation | After Opening Definition, before Installation |
| Installation | After Motivation, before Construction |
| Construction | After Installation, before Predefined Instances |
| Predefined Instances | After Construction, before Core Operations |
| Core Operations | Middle of document (required, usually positions 4–6) |
| Subtypes / Variants | After Core Operations, before Comparison |
| Comparison | After Subtypes, before Advanced Usage |
| Advanced Usage | After Comparison, before Integration |
| Integration | After Advanced Usage, before Running the Examples |
| Running the Examples | At the end |

**Fallback heuristic**: If the document has non-canonical heading names (e.g., "Creating Chunks" instead of "Construction"), treat them as their semantic equivalents:
- "Creating X" → Construction
- "Preconfigured Instances" → Predefined Instances
- "Usage Patterns" → Advanced Usage

**Once you determine the position:**
1. Find the line number of the preceding `##` heading (last before insertion point)
2. Find the line number of the following `##` heading (first after insertion point)
3. The new section will be inserted between these two headings

---

## Step 4 — Write the Section

**Mandatory:** Before writing, invoke these sub-skills for background:
- `/docs-writing-style` — prose rules
- `/docs-mdoc-conventions` — code block rules

Each section type has a specific structural template covering subsection layout, table layout, and the minimal code-block pattern. Load **[`references/section-patterns.md`](references/section-patterns.md)** when you reach this step — it contains templates for:

- Construction (factory methods, `apply`, `empty`, `from[B]`)
- Predefined Instances (table + example)
- Comparison (dimensions table + "Use X when… Use Y instead when…")
- Advanced Usage (2–4 realistic scenarios)
- Motivation (problem → naive approach → working solution)

---

## Step 5 — Insert the Section into the Document

Using the Edit tool, replace the content between the predecessor and successor headings:

**Insertion format:**
- Exactly one blank line above the new `##` heading
- The complete new section (all content including subsections)
- Exactly one blank line below the section's last line of content

After insertion, re-read ±10 lines around the insertion point to confirm natural flow with adjacent sections.

---

## Step 6 — Verify Compliance and Compilation

**Step 6a: Compliance Check**

Run the compliance verification:

```bash
/docs-verify-compliance <path-to-doc.md>
```

This delegates to:
1. `docs-check-compliance <path> docs-writing-style`
2. `docs-check-compliance <path> docs-mdoc-conventions`
3. `sbt "docs/mdoc --in <path>"`

Fix any violations before proceeding.

**Step 6b: Manual Mdoc Compilation**

Run:

```bash
sbt "docs/mdoc --in <path-to-doc.md>"
```

**Never use bare `sbt docs/mdoc`** — it recompiles all documentation (~90 seconds).

**Success criterion:** The output contains **zero `[error]` lines**. Warnings are acceptable.

**If errors appear:** Fix them immediately and re-run the single-file mdoc command until zero errors.

---

## Step 7 — Commit

Stage and commit the modified file:

```bash
git add <path-to-doc.md>
git commit -m "docs(<doc-stem>): add <section-name> section"
```

Replace:
- `<doc-stem>` with the reference doc's stem (e.g., `chunk` for `docs/reference/chunk.md`)
- `<section-name>` with the section name (e.g., `comparison`)

Example commit messages:
- `docs(chunk): add comparison section`
- `docs(schema): add advanced usage section`
- `docs(into): add predefined instances section`

---

## Common Mistakes

| Mistake | Fix |
|---|---|
| Heading immediately before a code fence with no prose | Add a prose sentence ending in `:` before the fence |
| Comparison section with no "Use X when…" guidance | Add mandatory per-type paragraphs after the table |
| Predefined instances listed in prose instead of table | Convert to a Markdown table grouped by category |
| Inline result comments (`// Right(42)`) in code examples | Delete comments; use `mdoc:compile-only` or Setup + Evaluated Output pattern |
| Section inserted at wrong position (not matching canonical ordering) | Re-check the canonical sequence and move to the correct line range |
| Bare `sbt docs/mdoc` without `--in` flag | Always use `sbt "docs/mdoc --in <path>"`; bare compilation takes ~90 seconds |
| Example code does not compile under mdoc | Verify all imports are included; run `mdoc --in` to check for errors |
| No blank line above or below the new section | Enforce exactly one blank line before the `##` and after the last line |
| Method signatures shown with extra keywords (`override`, `final`, `sealed`) | Strip to structural shape only; show method names, parameters, return types |

---

## Reused Skills

| Skill | When Used |
|---|---|
| `docs-research` | Step 2 — baseline research (delegate with `/docs-research`) |
| `docs-writing-style` | Step 4 — mandatory background before writing |
| `docs-mdoc-conventions` | Step 4 — mandatory background before writing |
| `docs-verify-compliance` | Step 6 — verify compliance and mdoc compilation |

---

## Verification Checklist

Before committing, walk through every item in the sibling **[`CHECKLIST.md`](CHECKLIST.md)**. It covers section selection, content quality, technical accuracy, mandatory compliance gates, cross-references, and commit hygiene.
