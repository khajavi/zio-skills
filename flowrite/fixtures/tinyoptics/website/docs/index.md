---
id: index
title: tinyoptics Documentation
---

# tinyoptics Documentation

Welcome to the **tinyoptics** documentation. tinyoptics is a tiny, dependency-free optics library for Scala 2.13 that provides meaningful functional data types for composable, immutable data access and update.

## What are Optics?

Optics are composable abstractions for accessing and updating immutable data structures. They solve the common problem of "nested immutable updates" — where updating a deeply nested field requires chains of `.copy()` calls.

tinyoptics provides four core optic types:

- **`Iso[S, A]`** — a lossless, reversible conversion between `S` and `A`.
- **`Lens[S, A]`** — focus on a part that is always present (a product field).
- **`Prism[S, A]`** — focus on one case of a sum type that may not match.
- **`Optional[S, A]`** — focus on a part that may be absent but can be replaced; the meet of `Lens` and `Prism`, and what their composition produces.

The unifying idea is **composition**: `andThen` chains optics to reach deeply nested data. A `Lens` composed with a `Prism` yields an `Optional`.

## Getting Started

- **Learning Guides** — start with the [Guides](guides/index.md) for progressive, tutorial-style introductions to optics.
- **API Reference** — see the [Optics API Reference](references/optics-api.md) for complete documentation of `Iso`, `Lens`, `Prism`, and `Optional`, including all composition methods.

## Key Features

- **Tiny & Dependency-Free** — no external dependencies, just pure Scala.
- **Composable** — chain optics together to handle deeply nested data.
- **Type-Safe** — fully generic, compile-time guarantees on optic operations.
- **Functional** — designed for immutable, functional data structures.
- **Scala 2.13** — built for modern Scala with support for case classes.

## Quick Start

Clone, compile, and run an example:

```bash
git clone https://github.com/your-org/tinyoptics.git
cd tinyoptics
sbt compile
sbt "runMain optics.Demo"
```

The core optics implementation lives in `src/main/scala/optics/`.
