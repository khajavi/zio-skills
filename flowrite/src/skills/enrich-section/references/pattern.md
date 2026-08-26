# The Five-Part Expansion Pattern

Replace a thin section — one that shows a signature and a toy example but never explains *why* a
reader would choose this API — with these five parts, in order.

## 1. Opening sentence

State what the method returns and the one-line rule for when to use it. Lead with the return type and
the key constraint that distinguishes it from the nearest alternative.

> `DynamicSchema#toSchema` returns a `Schema[DynamicValue]` — it stays fully in the dynamic world and
> requires no bindings. Use it when you have received a `DynamicSchema` over the wire and need a
> codec-compatible schema that enforces structural conformance without binding any Scala types.

## 2. Motivation paragraph

Explain the gap the method fills. Name the scenario where the alternative fails or is impractical.
Name the concrete contexts (middleware, gateways, converters, validators) where this method is the
right tool. "Useful in many cases" is not motivation — name one concrete scenario.

## 3. Contrast sentence or table

State explicitly: "Use X when … Use Y instead when …". One sentence is enough if the distinction is
clear; a two-row table if the dimensions are multiple.

| Situation | Right choice |
|---|---|
| No Scala types available; need structural validation only | `toSchema` |
| Have a `BindingResolver`; need a fully operational `Schema[A]` | `rebind[A]` |

Put the contrast before the signature block, after motivation — not buried at the end.

## 4. Signature block

Keep the existing signature block unchanged. Precede it with a bridging sentence ending in `:`.

## 5. Realistic example

Replace any toy example (single-field type, no context) with a scenario that could exist in a real
application, exercising the method's distinguishing behavior — the part that makes it different from
the alternative. Use a new type reflecting the motivated use-case, not the old toy type.

- Models a plausible real scenario (gateway, registry, pipeline, validator)
- Uses `mdoc:compile-only`
- Imports everything it needs
- No hardcoded output comments (`// None`, `// "hello"`, …)
- Preceded by a prose sentence ending in `:`

## Cross-references

Where the enriched API composes with a sibling type or a related section, link to it. A reader who
now understands *why* this API exists often needs to know what it hands off to next.

## Avoid bloat

Longer is not automatically better. A section that doubled in length earns that only if every added
paragraph carries information the reader needs — not filler, not a restatement, not content that
belongs in a different section type (a Construction example does not belong inside an enriched
Advanced Usage subsection), and nothing already said elsewhere on the same page.

## When a part is intentionally omitted

Some sections have no natural "naive approach" — the API has no precursor a reader would reach for
first. Say so in the section itself, briefly, so a future reader does not read the omission as an
oversight.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Motivation paragraph is abstract ("useful in many cases") | Name one concrete scenario |
| Contrast buried at the end | Put it before the signature block, after motivation |
| Example uses the same toy type as before | Create a new type that reflects the motivated use-case |
| Prose sentence before code does not end with `:` | Every sentence immediately before a code fence must end with `:` |
| Added output comments to show what expressions return | Delete them — mdoc evaluates and renders output automatically |
