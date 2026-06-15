---
name: docs-writing-style-mechanical
description: Mechanical prose style rules checkable via regex/script (Rules M-1 to M-17)
allowed-tools: Read, Glob, Grep
---

# ZIO Documentation Writing Style — Mechanical Rules

Prose rules automatable via bash/awk/regex. These rules are checked by `check-docs-style.sh` and reported as `[M-Rule N]` violations.

## Agent Workflow

**Phase 1 — Planning only, no edits yet**
Scan the document and identify every prose style violation (Rules M-1–M-17 below). For each violation, create one task:

> "Fix style – `<section>`:`<line>` (Rule `<N>`): `<short description>`"

Do not touch any source file until the full task list is created and you have listed it for confirmation.

**Phase 2 — Execution**
Apply all fixes. Mark each task `completed` as you finish it.

**Phase 3 — Mechanical validation**
After all tasks are `completed`, run:
```
bash ${CLAUDE_PLUGIN_ROOT}/skills/docs-writing-style-mechanical/check-docs-style.sh <file.md>
```
Verify exit code is 0. If not, re-open the relevant tasks and fix.

## Mechanical Validation

Before validating manually, run the mechanical style checks to catch common violations:

```
bash ${CLAUDE_PLUGIN_ROOT}/skills/docs-writing-style-mechanical/check-docs-style.sh <file.md>
```

This checks Rules M-1 through M-17 for mechanical violations. Run with `--help` for the full rule list and usage examples.

**Exit codes:**

| Code | Meaning                                                          |
|------|------------------------------------------------------------------|
| `0`  | No violations — all checked rules pass.                          |
| `1`  | One or more violations found. Details printed to stdout.         |
| `2`  | Invocation error (missing/extra arguments, file not found).      |

**Rule M-6** detects unqualified methods using heuristics (camelCase in backticks, confident if qualified elsewhere). Update `SAFE_NAMES` in `check-docs-style.sh` to avoid false positives.

## Mechanical Rules

**M-1. Tense**: Present tense only ("returns", "creates", "modifies").

**M-2. No padding/filler**: No filler phrases like "as we can see" or "it's worth noting that". Just state the fact.

**M-3. Bullet capitalization**: When a bullet point is a full sentence, start it with a capital letter.

**M-4. ASCII art usage**: Use it for diagrams showing data flow, type relationships, or architecture. Readers find these very helpful for understanding how pieces fit together.

**M-5. Link to related docs**: Use relative paths with the full filename including `.md` extension. Never use a bare directory name: ✅ `[Endpoint](./reference/endpoint/index.md)`, ❌ `[Endpoint](./reference/endpoint)`.

**M-6. Qualify method/constructor names (structural)**: Detect unqualified method references via heuristics: camelCase identifiers in backticks, dot-prefixed methods (`` `.method` ``). These structural patterns are always violations.
   - ❌ "Call `map` to transform elements" 
   - ✅ "Call `Chunk#map` to transform elements"

**M-7. No duplicate markdown heading**: Do not create a markdown heading (`#`) that duplicates the frontmatter title. The frontmatter title is sufficient.
   - ❌ Frontmatter has `title: "As Type"`, then document starts with `# As Type`
   - ✅ Start directly with `## Overview` or `## Use Cases`

**M-8. Heading hierarchy**: Use `##` for major sections, `###` for subsections, and `####` for subsubsections. All three levels are fully supported and encouraged. No level skips (e.g. `##` to `####`).

**M-9. No bare subheaders (structural)**: Check that `###` or `####` headers don't immediately follow `##` or `###` headers without prose between them (structural violation).

**M-10. No lone subheaders**: Never create a subsection with only one child.
   - ❌ `## Overview` → `### Definition` (only one subsection)
   - ✅ `## Overview` (put the definition content directly)

**M-11. Code block preceded by prose ending with `:`**: Never follow a heading directly with a code block. Always write an intro sentence that ends with `:`. Between consecutive code blocks, add bridging prose that explains what the next block demonstrates.
   - ❌ `#### Chunk#map` → (code block immediately)
   - ✅ `#### Chunk#map` → `To transform each element:` → (code block)

**M-12. Always include imports**: Every executable code block must start with the necessary import statements (scala mdoc*, python, javascript, etc.).

**M-13. Prefer `val` over `var`**: Use immutable patterns everywhere if possible in Scala code blocks.

**M-14. Table column alignment**: Align table columns with spaces for readability.
   - ❌ `| Name | Value |` / `| - | - |`
   - ✅ `| Name  | Value     |` / `| ----- | --------- |`

**M-15. Scala 2.13 syntax**: Use Scala 2.13 syntax only. Always use `import x._` for wildcard imports, never `import x.*`.

**M-16. Use @VERSION@ placeholder**: Use `@VERSION@` placeholder for version strings in dependency declarations, not hardcoded versions.
   - ❌ `libraryDependencies += "dev.zio" %% "zio-blocks" % "1.0.0"`
   - ✅ `libraryDependencies += "dev.zio" %% "zio-blocks" % "@VERSION@"`

**M-17. No implicit trace parameters**: ZIO convention — never include `implicit trace: Trace` in documented method signatures. It is a compiler implementation detail, not part of the public API.
   - ❌ `def take(implicit trace: Trace): UIO[A]`
   - ✅ `def take(): UIO[A]`
