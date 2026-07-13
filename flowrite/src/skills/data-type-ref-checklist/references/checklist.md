# Data Type Reference Review Checklist

Verify every item. The reference page is not done until all pass.

## Structure

- Opening definition appears immediately after the frontmatter with NO heading.
- The opening includes a plain ```scala structural block (no method bodies) showing the type's shape.
- A "Quick Showcase" section is present, and its code is a **single `mdoc:reset` block** — not split
  across multiple blocks.
- Sections appear in the template order (definition → motivation → showcase → installation →
  construction → predefined instances → core operations → subtypes → comparisons → advanced →
  integration → running the examples).
- Installation appears only for top-level module types; internal types omit it.
- Each Core-Operations method is a `####` subsection under its `###` category; no category has a
  single lone method (singletons are merged into a related category).
- No two code blocks are adjacent — an explanatory paragraph sits between every pair.

## Coverage & Content Quality

- Every public constructor / companion factory is documented under Construction.
- Every public method is documented under Core Operations, grouped by category.
- Each method subsection has: a `` `Name` — description `` header, plain-language explanation,
  a plain-`scala` signature block, and an `mdoc:silent:reset`/`mdoc:reset` usage example.
- Comparison sections (if present) use padded tables.
- "Running the Examples" (when standalone example files exist) embeds each via a
  `mdoc:embed:<path>:show-line-numbers` block inside a collapsible `<details>`.
- Writing style is checked mechanically rule-by-rule before this checklist runs — do not re-verify
  the `writing-style` rules here.

## Technical Accuracy

- All method signatures and type names match the actual source code. Verify each against its cited
  `source` (`path:L<start>-L<end>`) in the research: jump to those lines; if the member isn't there
  (source drifted), `grep "def <name>"` in that same file. Never trust the page's prose alone.
- Every constructor / operation / subtype carries a `source`, and a sampled path resolves to a real file.
- No deprecated methods or outdated patterns.
- `sbt "docs/mdoc --in docs/reference/<type>.md --out website/docs/reference/<type>.md"` reports zero
  `[error]` lines (mandatory before done).

## Review Cadence

- Fix EVERY failing item in a single editing pass — do not call this checklist again until all are addressed.
- Only re-review to confirm the fixes, not to discover the next issue one at a time.
- The review action enforces a hard call cap. When it reports the cap is reached, note remaining issues
  as known limitations and finish anyway — never keep calling it.
