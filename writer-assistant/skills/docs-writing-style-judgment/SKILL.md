---
name: docs-writing-style-judgment
description: Judgment-based prose style rules requiring language model understanding (Rules J-1 to J-9)
allowed-tools: Read, Glob, Grep
---

# ZIO Documentation Writing Style — Judgment-Based Rules

Prose rules that require language understanding and context. These rules are checked by the LLM-based docs-style-checker agent.

## Rules

**J-1. Person pronouns**: Use "we" when guiding the reader or walking through examples ("we can create...", "we need to..."). Use "you" when addressing the reader's choices ("if you need...", "you might want to...").

**J-2. No manual line breaks in prose**: Do not hard-wrap paragraph text at a fixed column. Write each paragraph as one continuous line.

**J-3. Qualify method names (ambiguous cases)**: When method references are ambiguous or could be misunderstood, qualify them. Heuristics (mechanical checks) catch camelCase identifiers and dot-prefixed methods; this rule handles edge cases where semantic understanding is needed.
   - ❌ "Call `map` in your pipeline"
   - ✅ "Call `Stream#map` in your pipeline"

**J-4. Type name alone rule**: When referring to a type (not a method), use only its name in backticks with no qualifier: "`As` derives automatically", "`List` is a sequence type", "convert to `Option`".

**J-5. No bare subheaders (quality check)**: Always write an intro sentence between a `##` header and its first `###` subheader. This rule checks whether existing prose is substantive and adequate, not just whether prose exists.
   - ❌ `## Operations` → `### Map` (no intro)
   - ✅ `## Operations` → `To transform values, use these operations.` → `### Map`

**J-6. When to use `####`**: Use `####` to organize multiple related topics under a single `###`. Requires judgment to determine whether topics are "related enough" to group.

**J-7. One concept per code block**: Each code block demonstrates one cohesive idea. Requires semantic understanding of what constitutes a single concept.

**J-8. Method signatures within containing type**: Document methods within their containing trait/class, not as bare signatures. Provides context about ownership and API surface.
   - ❌ `def map[B](f: A => B): ZIO[R, E, B] = ???`
   - ✅ `trait ZIO[-R, +E, +A] { def map[B](f: A => B): ZIO[R, E, B] = ??? }`

**J-9. Contextualized descriptions for code blocks**: Explain what code does and why it's relevant. Introduction must relate to what the code demonstrates, not generic phrases.
   - ❌ "Here's an example:"
   - ✅ "To extract the first three elements from the end of the chunk:"
