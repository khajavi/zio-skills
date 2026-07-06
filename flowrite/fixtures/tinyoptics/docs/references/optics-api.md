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

```scala
import optics._

case class Address(street: String, city: String)
case class Person(name: String, age: Int, address: Address)

val ageLens = Lens[Person, Int](
  get = _.age,
  set = newAge => p => p.copy(age = newAge)
)
// ageLens: Lens[Person, Int] = Lens(get = <function1>, set = <function1>)

val alice = Person("Alice", 30, Address("Main St", "Boston"))
// alice: Person = Person(
//   name = "Alice",
//   age = 30,
//   address = Address(street = "Main St", city = "Boston")
// )
val olderAlice = ageLens.set(31)(alice)
// olderAlice: Person = Person(
//   name = "Alice",
//   age = 31,
//   address = Address(street = "Main St", city = "Boston")
// )
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

```scala
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
// successPrism: Prism[Result, String] = Prism(
//   getOption = <function1>,
//   reverseGet = <function1>
// )

val okResult: Result = Success("OK")
// okResult: Result = Success(value = "OK")
val excited = successPrism.modify(_ + "!")(okResult)
// excited: Result = Success(value = "OK!")

val failedResult: Result = Failure("Error")
// failedResult: Result = Failure(error = "Error")
val unchanged = successPrism.modify(_ + "!")(failedResult)
// unchanged: Result = Failure(error = "Error")
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

```scala
val addressLens: Lens[Person, Address] = Lens(_.address, a => p => p.copy(address = a))
// addressLens: Lens[Person, Address] = Lens(
//   get = <function1>,
//   set = <function1>
// )
val cityLens: Lens[Address, String] = Lens(_.city, c => a => a.copy(city = c))
// cityLens: Lens[Address, String] = Lens(get = <function1>, set = <function1>)
val composedLens: Lens[Person, String] =
  addressLens.andThen(cityLens)
// composedLens: Lens[Person, String] = Lens(
//   get = optics.Lens$$Lambda/0x00007cc9112f62b0@2155c43b,
//   set = optics.Lens$$Lambda/0x00007cc9112f6680@6a64fde6
// )

sealed trait Shape
case class Circle(radius: Double) extends Shape
case class Item(shape: Shape)

val shapeLens: Lens[Item, Shape] = Lens(_.shape, s => i => i.copy(shape = s))
// shapeLens: Lens[Item, Shape] = Lens(get = <function1>, set = <function1>)
val circlePrism: Prism[Shape, Double] = Prism(
  { case Circle(r) => Some(r); case _ => None },
  Circle(_)
)
// circlePrism: Prism[Shape, Double] = Prism(
//   getOption = <function1>,
//   reverseGet = <function1>
// )
val composedOptional: Optional[Item, Double] =
  shapeLens.andThen(circlePrism)
// composedOptional: Optional[Item, Double] = Optional(
//   getOption = optics.Lens$$Lambda/0x00007cc9112fcf98@3a7e1cb,
//   set = optics.Lens$$Lambda/0x00007cc9112fd368@55e0f2bb
// )

sealed trait Event
sealed trait Target
case class Clicked(target: Target) extends Event
case class Button(id: String) extends Target

val clickedPrism: Prism[Event, Target] = Prism(
  { case Clicked(t) => Some(t); case _ => None },
  Clicked(_)
)
// clickedPrism: Prism[Event, Target] = Prism(
//   getOption = <function1>,
//   reverseGet = <function1>
// )
val buttonPrism: Prism[Target, String] = Prism(
  { case Button(id) => Some(id); case _ => None },
  Button(_)
)
// buttonPrism: Prism[Target, String] = Prism(
//   getOption = <function1>,
//   reverseGet = <function1>
// )
val composedPrism: Prism[Event, String] =
  clickedPrism.andThen(buttonPrism)
// composedPrism: Prism[Event, String] = Prism(
//   getOption = optics.Prism$$Lambda/0x00007cc9112fd738@68a43c61,
//   reverseGet = optics.Prism$$Lambda/0x00007cc9112fdb08@4dce3481
// )
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

```scala
val streetLens: Lens[Address, String] = Lens(
  get = _.street,
  set = newStreet => addr => addr.copy(street = newStreet)
)
// streetLens: Lens[Address, String] = Lens(
//   get = <function1>,
//   set = <function1>
// )

streetLens.get(alice.address)
// res0: String = "Main St"
```

### Creating a Prism for a Sealed Trait Case

```scala
sealed trait Message
case class Text(content: String) extends Message
case class Image(url: String) extends Message

val textPrism = Prism[Message, String](
  getOption = { case Text(c) => Some(c); case _ => None },
  reverseGet = Text(_)
)
// textPrism: Prism[Message, String] = Prism(
//   getOption = <function1>,
//   reverseGet = <function1>
// )
```

### Composing Through Multiple Levels

```scala
val bob = Person("Bob", 42, Address("Elm St", "Boston"))
// bob: Person = Person(
//   name = "Bob",
//   age = 42,
//   address = Address(street = "Elm St", city = "Boston")
// )
val relocated = composedLens.set("New York")(bob)
// relocated: Person = Person(
//   name = "Bob",
//   age = 42,
//   address = Address(street = "Elm St", city = "New York")
// )
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

