# Module Reference Page — Review Checklist

Run through every item before claiming the page is done. The mdoc-compile gate at the bottom is mandatory.

## Structure

- [ ] Structure choice (flat vs hierarchical) follows the default rule in `SKILL.md` Step 2 — and matches the module's actual shape
- [ ] If **flat**: a single `docs/reference/<module>.md` with all types under `##` headings
- [ ] If **hierarchical**: `docs/reference/<module>/index.md` exists and per-type pages are siblings (`<module>/<type>.md`)
- [ ] Frontmatter `id` matches the filename in either case

## Content Quality

- [ ] Opening paragraph names the module, lists its core types, and states the primary use case in 2–3 sentences
- [ ] **Type Inventory** lists every public type in the module (table or bullet list with one-line descriptions)
- [ ] Each core type has its own `##` section (flat) or sibling page (hierarchical)
- [ ] **How They Work Together** section shows a realistic end-to-end scenario combining 2–3 types — appears exactly once on the page
- [ ] **Integration Points** explains how this module relates to other modules in the same library
- [ ] No section restates concepts already covered in another section

## Per-Type Coverage

For each type covered:

- [ ] Construction (factory methods, `apply`, `empty`, …)
- [ ] Core operations grouped by concern
- [ ] At least one runnable example (`mdoc:compile-only` or `mdoc:silent`)
- [ ] Comparison / variants / subtypes sections exist when applicable

## Technical Accuracy

- [ ] Every method signature and type parameter matches the source
- [ ] All code blocks have correct mdoc modifiers (definitions use plain ```` ```scala ````, executable blocks use `mdoc*`)
- [ ] All imports are complete in every code block
- [ ] No deprecated methods or outdated patterns

## Compliance Checks (Mandatory Gates)

- [ ] `bash ${CLAUDE_PLUGIN_ROOT}/skills/docs-writing-style/check-docs-style.sh docs/reference/<module>.md` → exit 0
- [ ] `bash ${CLAUDE_PLUGIN_ROOT}/skills/docs-mdoc-conventions/check-mdoc-conventions.sh docs/reference/<module>.md` → exit 0
- [ ] `sbt "docs/mdoc --in docs/reference/<module>.md"` → zero `[error]` lines
- [ ] For hierarchical layout: run all three checks against every page in the subdirectory

## Integration

- [ ] The module page (or category) is wired into `docs/sidebars.js` (see `docs-integrate`)
- [ ] The module is linked from `docs/index.md`
- [ ] If hierarchical, each per-type page is also in the sidebar under the module category
- [ ] At least two existing pages cross-reference this module (or a type within it)
