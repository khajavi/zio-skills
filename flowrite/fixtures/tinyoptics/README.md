# tinyoptics

A tiny, dependency-free optics library for Scala 2.13 — meaningful functional
data types for composable, immutable data access and update.

## Data types

- **`Iso[S, A]`** — a lossless, reversible conversion between `S` and `A`.
- **`Lens[S, A]`** — focus on a part that is always present (a product field).
- **`Prism[S, A]`** — focus on one case of a sum type that may not match.
- **`Optional[S, A]`** — focus on a part that may be absent but can be replaced;
  the meet of `Lens` and `Prism`, and what their composition produces.

The unifying idea is composition: `andThen` chains optics to reach deeply nested
data. A `Lens` composed with a `Prism` yields an `Optional`.

## Try it

```bash
sbt compile
sbt "runMain optics.Demo"
```

See `src/main/scala/optics/Demo.scala` for worked examples.
