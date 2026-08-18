---
name: markdown-table
description: How to produce a Markdown table that is aligned and structurally valid — generate it from a Python script with a cell-count and escaping check, never by hand. Use when a page compares things across three or more columns, such as a type roster, an edge-case table, or a variant comparison.
---

# Markdown Tables

This is the method behind writing-style rule 22 ("align table columns with spaces for readability").
The rule says the columns must line up; this says how to make them line up without eyeballing.

## Method — do not hand-align

Renderers ignore source alignment, but humans reviewing diffs do not — and a dropped or extra `|` is
invisible until the table renders wrong. Both problems are mechanical, so let a script handle them:

1. Write a small Python script holding the data as a header list plus a list of row lists — never as
   pre-formatted strings.
2. Compute each column's width as the widest cell in that column, then pad every cell to it.
3. Assert before emitting: every row has exactly `len(header)` cells, no cell contains a raw newline,
   and every `|` inside a cell is escaped. Print `TABLE CHECK: ok`, or the failures.
4. Run it. Fix the **script** and rerun — never patch the rendered table.
5. Paste only the verified output.

Holding the data as rows rather than strings is what makes the check possible: a row with a missing cell
is a `len()` mismatch, which an assertion catches and a reader does not.

## Syntax rules

- Header row, then a separator row of `---` per column, with `:` for alignment — `:---` left, `---:`
  right, `:---:` center. Right-align numeric columns, left-align everything else.
- The separator row carries no padding spaces of its own: its dashes fill the whole cell, including the
  two columns the data rows spend on spaces either side. So a column of width `w` gets `w + 2` characters
  between its pipes — `:` plus `w + 1` dashes when left-aligned, the mirror when right-aligned:
  ✅ `|:---------|` ❌ `| :------- |`
- Escape `|` inside a cell as `\|`, **including inside backticks**, where it still breaks the table.
- Cells are single-line. Use `<br/>` for a forced break; a cell that wants a list or a code block means
  the table is the wrong container — use a definition list or headings.
- Docusaurus renders MDX, so `{` and `<` in a cell must be escaped or wrapped in backticks, or the
  parser reads them as JSX and the build fails.
- Prefer single-width characters. Emoji and CJK are ambiguous-width: they look padded to you and ragged
  to someone else. If a cell must contain them, pad by display width rather than `len()`.

## Content rules

- The first column is the key the reader scans — the thing they already know. Sort by it, or by the
  order the prose introduces.
- Every column must vary: ✅ a column whose values differ per row ❌ a column repeating one value, which
  belongs in the sentence above the table
- Three or more columns, or readers comparing across rows. Two columns of prose is a list:
  ✅ `| Method | Returns | Cost |` ❌ `| Method | What it does |` (write bullets)
- Header labels are short nouns — short enough not to widen the column past its data.
- No trailing "Notes" column absorbing whatever did not fit. If it does not fit a column, it is prose.
- Introduce the table with a sentence naming what to compare, and do not restate the rows underneath.

## Output

Paste the finished table only. Keep the script out of the page — it is scaffolding — and report its
`TABLE CHECK` line in your result so the next reader knows the table was verified rather than eyeballed.

## Worked shape

```python
header = ["Method", "Returns", "Cost"]
rows = [
    ["`record(name, by)`", "`Ledger`", "O(1)"],
    ["`tallyOf(name)`", "`Long`", "O(1)"],
    ["`absorb(that)`", "`Ledger`", "O(n)"],
]
align = ["left", "left", "right"]

bad = [(i, len(r)) for i, r in enumerate(rows) if len(r) != len(header)]
bad += [(i, "newline") for i, r in enumerate(rows) for c in r if "\n" in c]
bad += [(i, "unescaped |") for i, r in enumerate(rows) for c in r if "|" in c.replace(r"\|", "")]
print("TABLE CHECK: ok" if not bad else f"TABLE CHECK FAILED: {bad}")

width = [max(len(h), *(len(r[i]) for r in rows)) for i, h in enumerate(header)]
# `w + 1` dashes, not `w - 1`: the separator also covers the spaces a data row pads with.
sep = [f":{'-' * (w + 1)}" if a == "left" else f"{'-' * (w + 1)}:" for w, a in zip(width, align)]
line = lambda cells: "| " + " | ".join(
    c.rjust(w) if a == "right" else c.ljust(w) for c, w, a in zip(cells, width, align)
) + " |"
print("\n".join([line(header), "|" + "|".join(sep) + "|", *(line(r) for r in rows)]))
```

The `|`-escaping check deliberately strips `\|` first, so an already-escaped pipe passes and a bare one
fails — the failure that renders as a stray extra column.
