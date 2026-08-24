---
id: ledger
title: "Ledger"
---

`Ledger` is an append-only count of named events. Each name carries a running tally, and the ledger
is a plain immutable case class wrapping the map that holds them.

```scala
final case class Ledger(counts: Map[String, Long])
```

## Creating Values

A ledger is built from one of two companion members, never with the constructor directly.

`Ledger.blank` is a `val`, not a method — there is only ever one empty ledger, so it needs no
parameters and allocates once.

```scala
val blank: Ledger
```

`Ledger.seeded` starts a ledger from a single known tally, which saves a `record` call when the
first count is already in hand.

```scala
def seeded(name: String, count: Int): Ledger
```

## Core Operations

### Recording

`Ledger#record` sets the tally for a name. Recording the same name a second time replaces whatever
was there before, so the last call for a given name wins.

```scala
def record(name: String, by: Long): Ledger
```

### Reading

`Ledger#tallyOf` looks a name up. It returns `None` when the name was never recorded, which lets a
caller tell "counted zero times" apart from "never seen".

```scala
def tallyOf(name: String): Option[Long]
```

### Removing

`Ledger#erase` drops a name and its tally entirely, returning a ledger that no longer mentions it.

```scala
def erase(name: String): Ledger
```

### Merging

`Ledger#absorb` combines two ledgers that were kept separately. For any name the two share, the
larger of the two tallies is kept; names held by only one side are carried over unchanged.

```scala
def absorb(that: Ledger): Ledger
```

## Working with Window

`Window#tallied` is the bridge from the bounded window to the unbounded ledger: it counts the
window's retained readings by value and hands back a `Ledger`.

```scala
def tallied: Ledger
```
