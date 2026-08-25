---
id: ledger
title: "Ledger"
---

`Ledger` is an append-only count of named events: an immutable case class wrapping a map that holds a
running tally per event name. It returns back a new ledger from every operation, so a value you hold
never changes underneath you.

```scala
final case class Ledger(counts: Map[String, Long])
```

Because a ledger never loses a tally, partial results from several workers can be merged into one
total without coordinating them — each worker keeps its own ledger and the totals are summed at the
end.

## Working with Tallies

`Ledger` is an append-only count of named events, an immutable case class wrapping a map that holds a
running tally per event name. Every operation answers with a new value.

First record what happened, then read the totals back out:

```scala mdoc
import tally.Ledger

val ledger = Ledger.blank.record("open", 1L).record("open", 2L)
ledger.tallyOf("open")
```

Furthermore, a name that was never recorded still answers, and it answers zero rather than failing,
because `getOrElse` supplies the default:

```scala mdoc
ledger.tallyOf("never-seen")
```

## Core Operations

`Ledger` is an append-only count of named events — a map of a running tally per event name, wrapped
in an immutable case class.

### Recording

`record` adds `by` to a name's tally, starting from zero when the name is new. Recording the same
name twice adds to it rather than replacing it.

```scala
def record(name: String, by: Long): Ledger
```

As mentioned above, recording the same name twice adds to its tally rather than replacing it.

### Reading

`tallyOf` answers the tally for a name, or zero when nothing was ever recorded under it.

```scala
def tallyOf(name: String): Long
```

### Absorbing

`absorb` sums this ledger with another, adding the tallies of every name they share.

```scala
def absorb(that: Ledger): Ledger
```

Because a ledger never loses a tally, partial results from several workers can be merged into one
total without coordinating them — each worker keeps its own ledger and the totals are summed at the
end.

In addition, absorbing is how a batch is folded together once every worker has finished:

```scala mdoc
val first = Ledger.blank.record("open", 1L)
val second = Ledger.blank.record("open", 2L).record("close", 5L)
first.absorb(second)
```

## Constructing

Two companion members build a ledger, and the constructor is not used directly.

`Ledger.blank` is a `val`, not a method: there is only ever one empty ledger.

```scala
val blank: Ledger
```

`Ledger.seeded` starts a ledger from one known tally. Its count parameter is a `Long`, not an `Int`,
so a literal needs the `L` suffix.

```scala
def seeded(name: String, count: Long): Ledger
```
