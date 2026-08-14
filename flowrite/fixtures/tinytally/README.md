# tinytally

A tiny, dependency-free counting library for Scala 2.13.

## Data types

- **`Ledger`** — an append-only count of named events. `record` adds to a name's tally rather than
  replacing it, and `absorb` sums every name two ledgers share. There is no removal, so tallies only
  grow.
- **`Window`** — the most recent `capacity` readings, oldest dropped first. `admit` pushes a reading,
  `saturated` reports whether the next admit will drop one, and `tallied` summarizes the retained
  readings as a `Ledger`.

## Try it

```bash
sbt compile
sbt "runMain tally.Demo"
```

## Why it exists

This is a fixture for testing documentation agents end to end, not a library anyone should depend on.
It is deliberately small — two types, three methods each — and its API names are deliberately not
guessable from any real library, so an agent that invents facts instead of reading the source produces
something visibly wrong rather than something accidentally right.
