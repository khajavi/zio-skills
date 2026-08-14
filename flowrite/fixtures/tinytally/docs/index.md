---
id: index
title: TinyTally Documentation
---

Welcome to the **TinyTally** documentation. TinyTally is a tiny, dependency-free counting library for
Scala 2.13, built around two data types that trade off memory against history.

## The two data types

- **`Ledger`** — an append-only count of named events. Tallies only ever grow, and merging two ledgers
  sums every name they share.
- **`Window`** — the most recent `capacity` readings, oldest dropped first. Bounded, so it forgets.

They meet at `Window#tallied`, which summarizes a window's retained readings as a `Ledger`.

## Getting Started

- **Learning Guides** — see the [Guides](guides/index.md) for tutorial-style introductions.
- **API Reference** — see the [TinyTally API Reference](reference/index.md) for `Ledger` and `Window`.

## Quick Start

Compile and run the bundled examples:

```bash
sbt compile
sbt "runMain tally.Demo"
```

The implementation lives in `src/main/scala/tally/`.
