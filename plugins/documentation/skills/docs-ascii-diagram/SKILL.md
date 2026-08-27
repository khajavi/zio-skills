---
name: docs-ascii-diagram
description: How to produce an ASCII diagram that is actually aligned — generate it from a Python script with a width assertion, never by hand. Use when a page needs a box-and-arrow diagram, such as a module reference's "How They Work Together" section or a tutorial's data-flow picture.
allowed-tools: Read, Write, Bash(python3:*)
---

# ASCII Diagrams

## Method — do not hand-draw

Hand-drawn ASCII art is misaligned by one or two columns almost every time, and neither you nor a
reviewer spots it by reading. Alignment is arithmetic, so make arithmetic do it:

1. Write a small Python script that builds the diagram from data — a fixed inner width `W`, and helpers
   that pad every line to it.
2. End the script with an assertion that every box line is exactly `W + 2` characters. Print
   `WIDTH CHECK: all aligned`, or the list of offending `(index, length)` pairs.
3. Run it. If the check fails, fix the **script** and run again.
4. Paste only the verified output into the page.

**Never repair a diagram by editing the rendered text** — an edit that looks right in one place shifts
another line you are not looking at, and the next reader inherits a diagram no check has passed.

`W = 64` is a good default: wide enough for two annotated columns. Raise it only when the page renders
in a wide container, and keep the total under **76 columns** so the diagram survives narrow panes and
diffs.

## Character rules

- Box drawing: `┌ ┐ └ ┘ ─ │ ├ ┤ ┬ ┴ ┼`. Arrows: `▼ ▲ ◀ ▶`, or `->` and `<-`.
- Every character must be single-width. Ambiguous-width characters shift columns in some terminals,
  which is invisible where you author and broken where it is read:
  ✅ `1.` `2.` `3.` ❌ `①②③`, emoji, CJK
- Hold one style throughout: ✅ `─` everywhere ❌ `─` in one box and `-` in the next, `▼` beside `v`

## Content rules

- The diagram teaches the same structure the prose names, in the same words: if the text says "four
  phases", the diagram labels four phases with those names.
- Label edges, not just nodes — what flows along the arrow, and which way. An arrow pointing against
  the flow is worse than no arrow.
- Annotate with consequences, not mechanism:
  ✅ `nothing has run yet` ❌ `(lazy description)` · ✅ `wait right here` ❌ `(park thread)`
- Put the one fact readers most often get wrong on the spine of the diagram, where it cannot be skipped.
- Every element earns its place. Cut anything that repeats the prose without adding shape.

## Output

Put the diagram in the page inside a plain fence with **no language tag**, so no tooling tries to
compile it:

````
```
┌──────────────┐
│   Ledger     │
└──────┬───────┘
       │ record(name, by)
       ▼
````

Keep the script out of the page — it is scaffolding for producing the picture, not content for the
reader. Report its `WIDTH CHECK` line in your result so the next reader knows the diagram was verified
rather than eyeballed.

## Worked shape

```python
W = 64  # inner width; every box line ends up W + 2 with the borders


def box(label, note=""):
    body = f" {label}".ljust(W) if not note else f" {label}".ljust(W - len(note) - 1) + note + " "
    return [f"┌{'─' * W}┐", f"│{body}│", f"└{'─' * W}┘"]


lines = box("Ledger", "counts only grow") + ["    │ record(name, by)", "    ▼"] + box("Window")

bad = [(i, len(l)) for i, l in enumerate(lines) if l.startswith(("┌", "│", "└")) and len(l) != W + 2]
print("WIDTH CHECK: all aligned" if not bad else f"WIDTH CHECK FAILED: {bad}")
print("\n".join(lines))
```

Two things to tune per diagram: `W`, and whether the 76-column cap applies to the target.
