# Data Type Reference Page — Review Checklist

Run through every item before claiming the page is done. The mdoc-compile gate at the bottom is mandatory.

## Content Quality

- [ ] Frontmatter `id` matches the filename (kebab-case of the type)
- [ ] Page title is the simple type name (e.g., `Chunk`, not `zio.blocks.chunk.Chunk`)
- [ ] Opening paragraph names the type, its purpose, and the primary use case in 2–3 sentences
- [ ] **Quick Showcase** demonstrates the core capabilities in a single 10–20 line `mdoc:reset` block
- [ ] **Construction** documents every public factory method (no skips)
- [ ] **Core Operations** documents every public instance method (grouped by concern: transformation, query, combination, …)
- [ ] **Subtypes / Variants** section exists if the type is sealed or has named instances
- [ ] **Comparison** section exists when the type overlaps with another one (`Chunk` vs `Vector`, `Reader` vs `BufferedReader`)
- [ ] **Integration** section explains how this type fits with related module types
- [ ] No section consists of only a signature with a toy example — every section has a use-case sentence ("Use `foo` when…")

## Method Coverage (Mandatory Gate)

- [ ] Every public method on the type is documented (`docs-report-method-coverage` reports `fullCoverage: true`):

      ```bash
      scala-cli ${CLAUDE_PLUGIN_ROOT}/skills/docs-data-type-list-members/extract-members.scala \
        -- <Source.scala> <TypeName> \
        | bash ${CLAUDE_PLUGIN_ROOT}/skills/docs-report-method-coverage/check-method-coverage.sh \
            <TypeName> docs/reference/<type-name>.md
      ```

- [ ] Every public method on the **companion object** is documented
- [ ] Inherited methods are mentioned at least in the Integration section if they shape the type's API
- [ ] Private / package-private members are NOT documented

## Technical Accuracy

- [ ] All method signatures and type parameters match the actual source code
- [ ] All examples use correct mdoc modifiers (`mdoc`, `mdoc:silent`, `mdoc:compile-only`, `mdoc:reset`)
- [ ] All examples have complete imports — no `import zio.blocks._` to fish for definitions
- [ ] Type-definition blocks use plain ```` ```scala ```` (no mdoc modifier — they are illustrations, not executable)
- [ ] No deprecated methods or outdated patterns are used
- [ ] Cross-references to other types use relative paths: `[TypeName](./type-name.md)`

## Compliance Checks (Mandatory Gates)

Run **every** check below; each must report zero violations:

- [ ] `bash ${CLAUDE_PLUGIN_ROOT}/skills/docs-writing-style/check-docs-style.sh docs/reference/<type-name>.md` → exit 0
- [ ] `bash ${CLAUDE_PLUGIN_ROOT}/skills/docs-mdoc-conventions/check-mdoc-conventions.sh docs/reference/<type-name>.md` → exit 0
- [ ] `sbt "docs/mdoc --in docs/reference/<type-name>.md"` → zero `[error]` lines

If any check fails, return to the offending section, fix the violations, and re-run all three. Do not commit while any check is red.

## Companion Examples (when applicable)

- [ ] If you wrote substantial standalone examples, they live in `<library-name>-examples/src/main/scala/<package>/`
- [ ] Each example file is self-contained, compiles, and runs independently
- [ ] Each example has scaladoc including title, description, and `sbt "...examples/runMain"` command
- [ ] **Running the Examples** section embeds each example via `SourceFile.print` with description, source link, and run command (see `references/embedding-examples.md`)
- [ ] `sbt "<library-name>-examples/compile"` succeeds with no warnings

## Integration

- [ ] The page is added to `docs/sidebars.js` in the appropriate category
- [ ] The page is linked from `docs/index.md`
- [ ] At least two existing pages now cross-reference this page (use grep to find candidates)
