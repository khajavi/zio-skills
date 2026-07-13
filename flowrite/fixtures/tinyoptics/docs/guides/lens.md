---
id: lens
title: "Mastering Lenses — From Fields to Composition"
description: "Learn to create and compose Lenses to elegantly access and update deeply nested immutable data."
keywords: ["Lens Composition", "Field Access", "Immutable Updates", "Nested Structures"]
---
## Overview

A **Lens** is your tool for immutable, composable field access and updates. Instead of hand-writing copy chains for nested case classes, a Lens lets you focus on a single field and navigate through layers of structure, one level at a time. The real power emerges when you chain (compose) lenses together — suddenly, updating a field three levels deep requires just one lens operation.

This tutorial builds from creating a simple lens to composing multiple lenses and blending them with other optics to handle optional fields. By the end, you'll see why lenses transform nested immutable updates from tedious to elegant.

## 1. Creating Your First Lens

A `Lens[S, A]` is a pair of two functions: a **getter** that extracts a value of type `A` from a structure `S`, and a **setter** that creates an updated copy of `S` with a new value of type `A`. You construct a Lens by passing these two functions to the primary constructor.

Let's create a lens for a single field in a case class:

```scala mdoc:silent
import optics._

final case class Person(name: String, age: Int)
```

Now we'll build a lens that focuses on the `age` field:

```scala mdoc:silent
val ageLens: Lens[Person, Int] = Lens(
  // The getter: extract the age from a Person
  get = _.age,
  // The setter: create a new Person with an updated age
  set = newAge => person => person.copy(age = newAge)
)
```

The getter is straightforward — just extract the field. The setter takes the new value and returns a function that takes the whole structure and returns an updated copy using the case class's `copy` method. This two-function pair is the foundation of every lens.

Let's verify it works by creating a person and reading their age through the lens:

```scala mdoc
val alice = Person("Alice", 30)

// Extract the age using get
println(ageLens.get(alice))  // Prints: 30
```

That's it! You've created your first lens and used its `get` operation to read a field. The lens successfully extracted the age from Alice's structure without mutating anything.

## 2. Getting, Setting, and Modifying with a Lens

A lens exposes three core operations: `get`, `set`, and `modify`. You already used `get`; now let's explore the full trio.

**`get`** returns the focused value — you've seen this. **`set`** creates a new copy of the whole structure with the focused value replaced, leaving the original unchanged. **`modify`** applies a transformation function to the focused value and returns the updated structure.

Let's try all three:

```scala mdoc
// set: create a new Person with age 31, leaving alice unchanged
val older = ageLens.set(31)(alice)
println(s"Original: $alice")      // Person(Alice,30)
println(s"Updated:  $older")      // Person(Alice,31)

// modify: apply a function to increment the age
val incremented = ageLens.modify(_ + 1)(alice)
println(s"Modified: $incremented")  // Person(Alice,31)

// Verify the original is still unchanged
println(s"Still original: $alice")  // Person(Alice,30)
```

Notice how `set` and `modify` each take their arguments in curried form: `set(newVal)(whole)` and `modify(f)(whole)`. This style makes it easy to pass lenses to higher-order functions or compose them — a hint at what's coming next.

The three laws of lenses guarantee this immutability and consistency:
- **Get-set**: Setting to the current value and getting is identity — you haven't changed anything.
- **Set-get**: Getting after setting returns exactly what you set — the setter stores correctly.
- **Set-set**: The last set wins — each set is independent.

These laws make lenses predictable and safe to compose.

## 3. Composing Two Lenses with andThen

Now comes the real payoff. When you have nested structures, you can build a chain of lenses with `andThen`. Instead of writing `copy(address = address.copy(city = newCity))`, you compose two lenses and focus straight through.

Let's add nesting to our domain:

```scala mdoc:silent:nest
final case class Address(street: String, city: String)
final case class Person(name: String, age: Int, address: Address)
```

We'll create two lenses — one for the address field, and one for the city field inside an address:

```scala mdoc:silent
// Lens from Person to Address
val addressL: Lens[Person, Address] = Lens(
  _.address,
  addr => person => person.copy(address = addr)
)

// Lens from Address to String (the city)
val cityL: Lens[Address, String] = Lens(
  _.city,
  newCity => addr => addr.copy(city = newCity)
)
```

Now compose them with `andThen`:

```scala mdoc:silent
// Composed lens: Person -> Address -> String
val personCityL: Lens[Person, String] = addressL.andThen(cityL)
```

Let's use the composed lens to read and update the city, two levels deep:

```scala mdoc
val alice = Person("Alice", 30, Address("Main St", "Boston"))

// Get the city through two levels
println(personCityL.get(alice))  // Prints: Boston

// Set the city through two levels
val relocated = personCityL.set("Berlin")(alice)
println(relocated)
// Prints: Person(Alice,30,Address(Main St,Berlin))

// Modify the city through two levels
val uppercase = personCityL.modify(_.toUpperCase)(alice)
println(uppercase)
// Prints: Person(Alice,30,Address(Main St,BOSTON))
```

Composition is magic here. The composed lens knows how to drill through the `address` field, then through the `city` field, without you writing any intermediate `copy` calls. Each lens in the chain is reusable — `cityL` can focus on the city of any address, and `addressL` can focus on the address of any person.

## 4. Chaining Three Lenses for Deeper Nesting

The power of composition scales. You can chain as many lenses as your nesting demands. Let's add another level:

```scala mdoc:silent:nest
final case class Street(name: String, number: Int)
final case class Address(street: Street, city: String)
final case class Person(name: String, age: Int, address: Address)
```

Now we'll build a three-level chain:

```scala mdoc:silent
// Person -> Address
val addressL: Lens[Person, Address] = Lens(
  _.address,
  addr => person => person.copy(address = addr)
)

// Address -> Street
val streetL: Lens[Address, Street] = Lens(
  _.street,
  str => addr => addr.copy(street = str)
)

// Street -> Int (the street number)
val numberL: Lens[Street, Int] = Lens(
  _.number,
  num => street => street.copy(number = num)
)
```

Chain all three:

```scala mdoc:silent
val personStreetNumberL: Lens[Person, Int] = 
  addressL.andThen(streetL).andThen(numberL)
```

Use it:

```scala mdoc
val alice = Person(
  "Alice", 
  30, 
  Address(Street("Main St", 42), "Boston")
)

// Get the street number, three levels deep
println(personStreetNumberL.get(alice))  // Prints: 42

// Update the street number, three levels deep
val newAddress = personStreetNumberL.set(99)(alice)
println(newAddress)
// Prints: Person(Alice,30,Address(Street(Main St,99),Boston))

// Modify the street number, three levels deep
val doubled = personStreetNumberL.modify(_ * 2)(alice)
println(doubled)
// Prints: Person(Alice,30,Address(Street(Main St,84),Boston))
```

Three lenses chained behave exactly like a single lens at that depth. You haven't sacrificed clarity for depth. This is the composability principle at work — each lens is a reusable building block, and you stack them as needed.

## 5. Composing a Lens with a Prism to Get an Optional

Lenses assume the focus is always present. But sometimes your nested structure has a field that might not match a pattern — for example, a shape field that could be a Circle or a Rectangle, but you only care about circles. This is where you compose with a **Prism**.

When you call `andThen` with a Prism instead of another Lens, the result is an `Optional[S, B]` — a focus that may be absent, yet can still be updated when present.

Let's build this scenario:

```scala mdoc:silent
sealed trait Shape
final case class Circle(radius: Double) extends Shape
final case class Rectangle(width: Double, height: Double) extends Shape

final case class Favourite(shape: Shape)
```

Create a lens for the shape field, and a prism that matches only circles:

```scala mdoc:silent
// Lens: Favourite -> Shape (always present)
val shapeL: Lens[Favourite, Shape] = Lens(
  _.shape,
  s => f => f.copy(shape = s)
)

// Prism: Shape -> Double (only if it's a Circle)
val circlePrism: Prism[Shape, Double] = Prism(
  { case Circle(r) => Some(r); case _ => None },
  Circle(_)
)
```

Compose them with `andThen`:

```scala mdoc:silent
val favouriteRadiusL: Optional[Favourite, Double] = 
  shapeL.andThen(circlePrism)
```

Now use the resulting Optional:

```scala mdoc
val adminFav = Favourite(Circle(5.0))
val guestFav = Favourite(Rectangle(3.0, 4.0))

// Try to get the radius (succeeds for Circle)
println(favouriteRadiusL.getOption(adminFav))   // Prints: Some(5.0)

// Try to get the radius (fails for Rectangle)
println(favouriteRadiusL.getOption(guestFav))   // Prints: None

// Modify: only updates if it's a Circle
val enlarged = favouriteRadiusL.modify(_ * 2)(adminFav)
println(enlarged)  // Prints: Favourite(Circle(10.0))

val unchanged = favouriteRadiusL.modify(_ * 2)(guestFav)
println(unchanged) // Prints: Favourite(Rectangle(3.0,4.0))
```

The Optional bridges the always-present (Lens) and the conditional (Prism). When you compose them, you get a single focus that correctly handles the absence of a match. No manual if-else chains, no nested pattern matching — just compose and let the optic handle it.

## Putting It Together

Here's a complete example that exercises all the patterns we've learned: single-level lenses, composition, and optional composition:

```scala mdoc:compile-only
import optics._

// --- Domain types ---
final case class Street(name: String, number: Int)
final case class Address(street: Street, city: String)
final case class Person(name: String, age: Int, address: Address)

sealed trait Role
final case class Admin(level: Int) extends Role
final case class Guest(id: String) extends Role

final case class Employee(person: Person, role: Role)

// --- Lenses for single fields ---
val personL: Lens[Employee, Person] = Lens(
  _.person,
  p => e => e.copy(person = p)
)

val addressL: Lens[Person, Address] = Lens(
  _.address,
  a => p => p.copy(address = a)
)

val cityL: Lens[Address, String] = Lens(
  _.city,
  c => a => a.copy(city = c)
)

val ageL: Lens[Person, Int] = Lens(
  _.age,
  n => p => p.copy(age = n)
)

// --- Composed lenses ---
val employeeCityL: Lens[Employee, String] = personL.andThen(addressL).andThen(cityL)
val employeeAgeL: Lens[Employee, Int] = personL.andThen(ageL)

// --- Prism for role ---
val adminPrism: Prism[Role, Int] = Prism(
  { case Admin(level) => Some(level); case _ => None },
  Admin(_)
)

val employeeAdminLevelL: Optional[Employee, Int] = 
  Lens[Employee, Role](_.role, r => e => e.copy(role = r)).andThen(adminPrism)

// --- Usage ---
def main: Unit = {
  val emp = Employee(
    Person("Alice", 30, Address(Street("Main St", 42), "Boston")),
    Admin(2)
  )

  println("Original employee: " + emp)
  
  // Update city through two levels
  val relocated = employeeCityL.set("Berlin")(emp)
  println("After city update: " + relocated)
  
  // Increment age through one level
  val older = employeeAgeL.modify(_ + 1)(emp)
  println("After age increment: " + older)
  
  // Update admin level (succeeds)
  val promoted = employeeAdminLevelL.modify(_ + 1)(emp)
  println("After promotion: " + promoted)
  
  // Try to update guest level (no effect, since role is Admin)
  val guest = emp.copy(role = Guest("guest123"))
  val unchanged = employeeAdminLevelL.modify(_ + 1)(guest)
  println("Guest unchanged: " + unchanged)
}
```

Run this example mentally: you build a few simple lenses for individual fields, then chain them in different combinations. The lenses compose cleanly, and when you mix in a prism, the optional behavior falls out naturally. That's the composition pattern at its best.

## Running the Examples

To run the examples in this tutorial, clone the TinyOptics repository and build the project:

```bash
git clone https://github.com/zio/tinyoptics.git
cd tinyoptics
```

Compile the code to verify the examples:

```bash
sbt "compile"
```

If you've created a runnable main object in the `examples/` directory, run it with:

```bash
sbt "runMain optics.Demo"
```

This runs the full demo from the library, which includes lens, prism, and optional examples. You can modify the example files, recompile, and re-run to experiment with the patterns you've learned.

## What You've Learned

You now understand:

- **Creating a Lens**: Use the two-function constructor (getter and setter) to focus on a single always-present field.
- **Using Lens Operations**: `get` reads the focus, `set` creates an updated copy, and `modify` applies a transformation — all immutably.
- **Composing Lenses**: Chain lenses with `andThen` to navigate multiple levels without manual copy chains.
- **Chaining Multiple Levels**: Compose three or more lenses to reach deeply nested values, scaling cleanly.
- **Composing with a Prism**: Mix a Lens and a Prism to get an Optional, handling conditional field access composably.

The core insight is that a Lens is not just a getter-setter pair — it's a composable abstraction that lets you build arbitrarily deep navigations by chaining reusable single-level focuses together, transforming nested immutable updates from tedious copy chains into elegant, one-liner operations.

## Where to Go Next

- **Learn Prisms** — explore safe branching on sealed traits and conditional pattern matching with the same compositional ease.
- **Explore Optionals** — understand the full picture of Lens + Prism composition and how to handle absent focuses at any depth.
- **Study the API Reference** — read the detailed [Optics API Reference](references/optics-api.md) for complete method signatures and additional operations.
- **Dive into the Source** — browse `src/main/scala/optics/` to see how lenses, prisms, and optionals are implemented.