# Enrich Section — Review Checklist

Use after expanding a thin section to confirm the enrichment actually made it more useful, not merely longer.

## Diagnosis Was Correct

- [ ] The section was genuinely thin per `SKILL.md` Signals (signature + toy example, no motivation)
- [ ] The section's purpose was not "API reference" only — readers need *why*, not just *what*
- [ ] The enrichment was needed; not just rewriting prose for taste

## Five-Part Expansion Pattern Applied

- [ ] **Motivation** paragraph: states the problem this API solves
- [ ] **Naive approach** (when applicable): shows what readers might try without this API and why it falls short
- [ ] **Realistic example**: a use-case-grounded example, not a toy
- [ ] **Common Mistakes / Pitfalls**: addresses at least one non-obvious behaviour readers will hit
- [ ] **Cross-references**: links to related sections / types where the API composes

If a part is intentionally omitted (e.g., no naive approach because the API has no precursor), say so in the section so a future reader doesn't think it's missing by accident.

## Content Quality

- [ ] No filler ("It's worth noting that…", "Importantly…", "As we can see…")
- [ ] Every code block is preceded by a prose sentence ending in `:`
- [ ] Examples are concrete (real types, real values), not `Foo`/`Bar`/`x`/`y`
- [ ] The section now answers: "When would I reach for this?"

## Technical Accuracy

- [ ] Every signature matches the source code
- [ ] Every example uses correct mdoc modifiers and would compile
- [ ] All imports are complete in every code block

## Compliance Checks (Mandatory Gates)

- [ ] `bash ${CLAUDE_PLUGIN_ROOT}/skills/docs-writing-style/check-docs-style.sh <doc-file>` → exit 0
- [ ] `bash ${CLAUDE_PLUGIN_ROOT}/skills/docs-mdoc-conventions/check-mdoc-conventions.sh <doc-file>` → exit 0
- [ ] `sbt "docs/mdoc --in <doc-file>"` → zero `[error]` lines

## Avoid Bloat

- [ ] The section is longer than before, but not gratuitously so — if it doubled in length, every paragraph earns its place
- [ ] No content was added that belongs in a different section type (don't put Construction examples in an Advanced Usage subsection)
- [ ] No information was duplicated from another section in the same document

## Commit

- [ ] One commit per enriched section (don't bundle multiple unrelated enrichments)
- [ ] Commit message names the section and the doc file (e.g., "docs(chunk): enrich Construction with motivation and pitfalls")
