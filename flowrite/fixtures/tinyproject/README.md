# tinyproject

A tiny, dependency-free Scala 2.13 library in two independent modules.

## `optics` — composable data access

- **`Iso[S, A]`** — a lossless, reversible conversion between `S` and `A`.
- **`Lens[S, A]`** — focus on a part that is always present (a product field).
- **`Prism[S, A]`** — focus on one case of a sum type that may not match.
- **`Optional[S, A]`** — focus on a part that may be absent but can be replaced; the meet of `Lens`
  and `Prism`, and what their composition produces.

The unifying idea is composition: `andThen` chains optics to reach deeply nested data. A `Lens`
composed with a `Prism` yields an `Optional`.

## `tally` — counting

- **`Ledger`** — an append-only count of named events. `record` adds to a name's tally rather than
  replacing it, and `absorb` sums every name two ledgers share. There is no removal, so tallies only
  grow.
- **`Window`** — the most recent `capacity` readings, oldest dropped first. `admit` pushes a reading,
  `saturated` reports whether the next admit will drop one, and `tallied` summarizes the retained
  readings as a `Ledger`.

## Try it

```bash
sbt compile
sbt "runMain optics.Demo"
sbt "runMain tally.Demo"
```

Sources live under `optics/src/main/scala/optics/` and `tally/src/main/scala/tally/`.

## Why it exists

This is a fixture for testing documentation agents end to end, not a library anyone should depend on.
Each module is deliberately small, and their API names are deliberately not guessable from any real
library, so an agent that invents facts instead of reading the source produces something visibly wrong
rather than something accidentally right.

Two modules rather than one, because a single-module repo cannot exercise what breaks in a real one:
choosing which module a type belongs to, routing a reference index between modules, keeping a page
about one module from drifting into the other, and grouping a sidebar across both.
