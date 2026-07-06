---
id: optics-api
title: Optics API Reference
---

# Optics API Reference

Complete API documentation for tinyoptics core types and operations.

## Core Types

### Iso[S, A]

An **Iso** (Isomorphism) represents a lossless, reversible conversion between two types `S` and `A`.

**Type:** `trait Iso[S, A]`

**Key Operations:**
- `def get(s: S): A` — Convert from `S` to `A`
- `def build(a: A): S` — Convert from `A` to `S` (reverse direction)
- `def andThen[B](other: Iso[A, B]): Iso[S, B]` — Compose with another Iso

**Use case:** When you have a perfect bidirectional transformation (e.g., wrapping/unwrapping a value type).

---

### Lens[S, A]

A **Lens** is a composable pair of get and set functions that focus on a single field in an immutable structure.

**Type:** `trait Lens[S, A]`

**Key Operations:**
- `def get(s: S): A` — Extract the focused value from a structure
- `def set(a: A)(s: S): S` — Create an updated copy with the focused value changed
- `def modify(f: A => A)(s: S): S` — Transform the focused value and return updated copy
- `def andThen[B](other: Lens[A, B]): Lens[S, B]` — Compose with another Lens
- `def andThen[B](other: Prism[A, B]): Optional[S, B]` — Compose with a Prism to get an Optional

**Use case:** Focus on a field that is always present in a product type (case class).


**Example:**

```scala mdoc:reset-object
import optics._

case class Person(name: String, age: Int)

val ageLens = Lens[Person, Int](
  get = _.age,
  set = newAge => p => p.copy(age = newAge)
)

val alice = Person("Alice", 30)
val updated = ageLens.set(31)(alice)
```

---

### Prism[S, A]

A **Prism** extends the Lens pattern to handle optional values or sum types (sealed traits). It can match or not match a pattern.

**Type:** `final case class Prism[S, A]`

**Constructor Parameters:**
- `getOption: S => Option[A]` — Try to extract the focused value; returns `None` if pattern doesn't match
- `reverseGet: A => S` — Construct the whole from the focused value

**Key Operations:**
- `def getOption(s: S): Option[A]` — Try to extract the focused value; returns `None` if pattern doesn't match
- `def modify(f: A => A)(s: S): S` — Transform the focused value if matched, otherwise leave unchanged
- `def isMatching(s: S): Boolean` — Check if the pattern matches
- `def asOptional: Optional[S, A]` — Convert to an Optional, where `set` only applies when matched
- `def andThen[B](other: Lens[A, B]): Optional[S, B]` — Compose with a Lens to get an Optional
- `def andThen[B](other: Prism[A, B]): Prism[S, B]` — Compose with another Prism

**Use case:** Focus on one case of a sealed trait, or handle optional/nullable fields safely.


**Example:**

```scala mdoc:reset-object
import optics._

sealed trait Result
case class Success(value: String) extends Result
case class Failure(error: String) extends Result

val successPrism = Prism[Result, String](
  getOption = {
    case Success(v) => Some(v)
    case _          => None
  },
  reverseGet = v => Success(v)
)

val result: Result = Success("OK")
val updated = successPrism.modify(_ + "!")(result)

val failed: Result = Failure("Error")
val unchanged = successPrism.modify(_ + "!")(failed)
```

---

### Optional[S, A]

An **Optional** is a composition of a Lens and a Prism, focusing on a part that may be absent but can be replaced.

**Type:** `trait Optional[S, A]`

**Created by:**
- Composing a `Lens` with a `Prism` via `.andThen()`
- Composing a `Prism` with a `Lens` via `.andThen()`

**Key Operations:**
- `def getOption(s: S): Option[A]` — Try to extract the focused value through both Lens and Prism
- `def set(a: A)(s: S): S` — Set the focused value if it matches the prism pattern
- `def modify(f: A => A)(s: S): S` — Transform the focused value if it matches

**Use case:** Navigate through structures where some intermediate fields may not match expected patterns.


---

## Composition

### Combining Optics

All optic types support composition via `.andThen()`:

```scala mdoc:reset-object
import optics._

case class Address(street: String, city: String)
case class Person(name: String, address: Address)

val addressLens: Lens[Person, Address] = Lens(_.address, a => p => p.copy(address = a))
val cityLens: Lens[Address, String] = Lens(_.city, c => a => a.copy(city = c))
val composedLens: Lens[Person, String] =
  addressLens.andThen(cityLens)

sealed trait Shape
case class Circle(radius: Double) extends Shape
case class Item(shape: Shape)

val shapeLens: Lens[Item, Shape] = Lens(_.shape, s => i => i.copy(shape = s))
val circlePrism: Prism[Shape, Double] = Prism(
  { case Circle(r) => Some(r); case _ => None },
  Circle(_)
)
val composedOptional: Optional[Item, Double] =
  shapeLens.andThen(circlePrism)

sealed trait Event
sealed trait Target
case class Clicked(target: Target) extends Event
case class Button(id: String) extends Target

val clickedPrism: Prism[Event, Target] = Prism(
  { case Clicked(t) => Some(t); case _ => None },
  Clicked(_)
)
val buttonPrism: Prism[Target, String] = Prism(
  { case Button(id) => Some(id); case _ => None },
  Button(_)
)
val composedPrism: Prism[Event, String] =
  clickedPrism.andThen(buttonPrism)
```

**Composition Table:**

| Type 1 | Type 2 | Result |
|--------|--------|--------|
| `Iso[S, A]` | `Iso[A, B]` | `Iso[S, B]` |
| `Lens[S, A]` | `Lens[A, B]` | `Lens[S, B]` |
| `Lens[S, A]` | `Prism[A, B]` | `Optional[S, B]` |
| `Prism[S, A]` | `Lens[A, B]` | `Optional[S, B]` |
| `Prism[S, A]` | `Prism[A, B]` | `Prism[S, B]` |


---

## Common Patterns

### Creating a Lens for a Case Class Field

```scala mdoc:reset-object
import optics._

case class Address(street: String, city: String)

val cityLens = Lens[Address, String](
  get = _.city,
  set = newCity => addr => addr.copy(city = newCity)
)
```

### Creating a Prism for a Sealed Trait Case

```scala mdoc:reset-object
import optics._

sealed trait Message
case class Text(content: String) extends Message
case class Image(url: String) extends Message

val textPrism = Prism[Message, String](
  getOption = { case Text(c) => Some(c); case _ => None },
  reverseGet = Text(_)
)
```

### Composing Through Multiple Levels

```scala mdoc:reset-object
import optics._

case class Address(street: String, city: String)
case class Person(name: String, address: Address)

val personAddressLens = Lens[Person, Address](_.address, a => p => p.copy(address = a))
val addressCityLens = Lens[Address, String](_.city, c => a => a.copy(city = c))

val personCityLens: Lens[Person, String] =
  personAddressLens.andThen(addressCityLens)

val person = Person("Alice", Address("Main St", "Boston"))
val updated = personCityLens.set("New York")(person)
```

---

## Operations Reference

### Lens Operations

| Operation | Signature | Returns | Purpose |
|-----------|-----------|---------|---------|
| `get` | `get(s: S): A` | `A` | Extract the focused value |
| `set` | `set(a: A)(s: S): S` | `S` | Create updated copy with new value |
| `modify` | `modify(f: A => A)(s: S): S` | `S` | Transform focused value and return updated copy |
| `andThen` | `andThen[B](other: Lens[A, B]): Lens[S, B]` | `Lens[S, B]` | Compose with another Lens |

### Prism Operations

| Operation | Signature | Returns | Purpose |
|-----------|-----------|---------|---------|
| `getOption` | `getOption(s: S): Option[A]` | `Option[A]` | Try to extract value if pattern matches |
| `isMatching` | `isMatching(s: S): Boolean` | `Boolean` | Check if the pattern matches |
| `modify` | `modify(f: A => A): S => S` | `S => S` | Transform if matched, else unchanged |
| `modifyOption` | `modifyOption(f: A => A): S => Option[S]` | `S => Option[S]` | Transform if matched, return None if not |
| `asOptional` | `asOptional: Optional[S, A]` | `Optional[S, A]` | Convert to an Optional |
| `andThen` | `andThen[B](other: Prism[A, B]): Prism[S, B]` | `Prism[S, B]` | Compose with another Prism |

