---
id: code-heavy
title: "Lens"
---

A `Lens` focuses one field that is always present, so reading through it always succeeds and writing
through it always produces a new structure with that field replaced.

## Reading and writing

```scala mdoc:silent
import optics.Lens

final case class Address(city: String, zip: String)
final case class Person(name: String, address: Address)

val addressLens: Lens[Person, Address] = Lens(_.address, a => p => p.copy(address = a))
val cityLens: Lens[Address, String] = Lens(_.city, c => a => a.copy(city = c))
```

`get` returns the focused field and `set` returns a copy of the whole structure with that field
replaced. Neither can fail.

## Composition

```scala mdoc
val personCity = addressLens.andThen(cityLens)
val person = Person("Ada", Address("London", "NW1"))
personCity.get(person)
```

Composing two lenses gives a lens that reaches through both steps in one move. The order matters:
the outer lens comes first.

## Laws

| law | statement |
|---|---|
| get-set | `set(get(s))(s) == s` — writing back what you read changes nothing |
| set-get | `get(set(a)(s)) == a` — reading after a write returns what you wrote |
| set-set | `set(b)(set(a)(s)) == set(b)(s)` — the last write wins |

## A note on YAML in examples

A page may legitimately contain a `---` line inside a fence, which is why a frontmatter parser has to
stop at the *first* closing delimiter rather than the last:

```yaml
id: some-other-page
title: "Not This Page"
---
```

That block is documentation content, not this page's frontmatter, and nothing may treat it as such.

## Updating

```scala mdoc
personCity.set("Cambridge")(person)
```

`set` through a composed lens rebuilds only the structures on the path to the focused field.
