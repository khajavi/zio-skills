# Add Missing Section — Review Checklist

Run through every item after Step 6 (Verify) and before Step 7 (Commit). The mdoc-compile gate is mandatory.

## Section Selection

- [ ] The section being added is genuinely missing (not just thin) — if it exists but lacks substance, use `docs-enrich-section` instead
- [ ] The section type is one of: Construction, Predefined Instances, Comparison, Advanced Usage, Motivation
- [ ] The section's insertion point follows the canonical ordering documented in `SKILL.md` Step 1
- [ ] The chosen pattern from `references/section-patterns.md` is followed exactly (subsection layout, table layout, code-block modifier)

## Content Quality

- [ ] The section opens with a one-sentence framing (what's in this section, why a reader would read it)
- [ ] Every subsection (`###`) has at least one runnable example
- [ ] Every code block is preceded by a prose sentence ending in `:` (Rule 15)
- [ ] No bare subheaders (no `###` immediately after `##` without intervening prose)
- [ ] The section reads coherently when read in isolation — a reader who jumped here directly should still understand the context

## Technical Accuracy

- [ ] Every method signature and type parameter matches the source code
- [ ] Every example uses correct mdoc modifiers (use `references/section-patterns.md` cross-pattern rules)
- [ ] Every example has complete imports
- [ ] Type-definition illustrations (e.g., factory signatures) use plain ```` ```scala ```` (no mdoc)

## Compliance Checks (Mandatory Gates)

- [ ] `bash ${CLAUDE_PLUGIN_ROOT}/skills/docs-writing-style/check-docs-style.sh <doc-file>` → exit 0
- [ ] `bash ${CLAUDE_PLUGIN_ROOT}/skills/docs-mdoc-conventions/check-mdoc-conventions.sh <doc-file>` → exit 0
- [ ] `sbt "docs/mdoc --in <doc-file>"` → zero `[error]` lines

If any check fails, return to the new section and fix the violations. Do not commit while any check is red.

## Cross-References

- [ ] The new section links to related types / sections using relative paths (`[TypeName](./type-name.md)`)
- [ ] At least one existing section in the same document was updated to point at the new section if it makes sense (e.g., a Construction subsection mentioning a Predefined Instance)
- [ ] No links broke as a result of the insertion (mdoc gate covers this)

## Commit

- [ ] One commit per section addition (don't bundle multiple unrelated section additions)
- [ ] Commit message names the section type and the doc file (e.g., "docs(chunk): add Comparison section vs Vector")
- [ ] If the addition revealed an unrelated issue (typo, broken link), fix it in a separate commit
