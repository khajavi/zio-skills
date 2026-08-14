---
id: index
title: TinyProject Documentation
---

Welcome to the **TinyProject** documentation. TinyProject is a tiny, dependency-free Scala 2.13
library in two independent modules.

## The modules

- **`optics`** — composable, immutable data access and update: `Iso`, `Lens`, `Prism`, `Optional`.
  The unifying idea is composition — `andThen` chains optics to reach deeply nested data.
- **`tally`** — counting: `Ledger` accumulates named event counts forever, `Window` keeps only the
  most recent readings and forgets the rest.

The modules share nothing. Pick the one whose problem you have.

## Getting Started

- **Learning Guides** — see the [Guides](guides/index.md) for tutorial-style introductions.
- **API Reference** — see the [API Reference](reference/index.md) for both modules.

## Quick Start

Compile and run the bundled examples:

```bash
sbt compile
sbt "runMain optics.Demo"
sbt "runMain tally.Demo"
```

The implementations live in `optics/src/main/scala/optics/` and `tally/src/main/scala/tally/`.
