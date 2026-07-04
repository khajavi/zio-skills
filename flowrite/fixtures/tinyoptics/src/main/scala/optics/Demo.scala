package optics

/**
 * Domain types and runnable usage examples for the tinyoptics library. These
 * demonstrate the three core patterns: nested-field updates with [[Lens]], safe
 * ADT-case access with [[Prism]], and their composition into an [[Optional]].
 *
 * Run with: `sbt "runMain optics.Demo"`
 */
object Demo {

  // --- A small product hierarchy for lenses -------------------------------

  final case class Address(street: String, city: String)
  final case class Person(name: String, age: Int, address: Address)

  val addressL: Lens[Person, Address] =
    Lens(_.address, a => p => p.copy(address = a))
  val cityL: Lens[Address, String] =
    Lens(_.city, c => a => a.copy(city = c))
  val ageL: Lens[Person, Int] =
    Lens(_.age, n => p => p.copy(age = n))

  /** Deep field update: focus the city inside the address inside the person. */
  val personCityL: Lens[Person, String] = addressL.andThen(cityL)

  // --- A small sum type for prisms ----------------------------------------

  sealed trait Shape
  final case class Circle(radius: Double) extends Shape
  final case class Rectangle(width: Double, height: Double) extends Shape

  val circleRadiusP: Prism[Shape, Double] =
    Prism(
      { case Circle(r) => Some(r); case _ => None },
      Circle(_),
    )

  // --- An iso between equivalent shapes -----------------------------------

  final case class Celsius(value: Double)
  val celsiusIso: Iso[Celsius, Double] = Iso(_.value, Celsius(_))

  def main(args: Array[String]): Unit = {
    val ana = Person("Ana", 30, Address("1 Main St", "Rome"))

    println("Lens get:    " + personCityL.get(ana))
    println("Lens set:    " + personCityL.set("Berlin")(ana))
    println("Lens modify: " + ageL.modify(_ + 1)(ana))

    println("Prism match:    " + circleRadiusP.getOption(Circle(2.0)))
    println("Prism no-match: " + circleRadiusP.getOption(Rectangle(1.0, 2.0)))
    println("Prism modify:   " + circleRadiusP.modify(_ * 2)(Circle(2.0)))

    println("Iso to/from: " + celsiusIso.from(celsiusIso.to(Celsius(21.0))))

    // Lens andThen Prism => Optional: the radius of a person's "favourite" shape.
    val favouriteL: Lens[Favourite, Shape] =
      Lens(_.shape, s => f => f.copy(shape = s))
    val favouriteRadius: Optional[Favourite, Double] =
      favouriteL.andThen(circleRadiusP)

    println("Optional present: " + favouriteRadius.modify(_ * 10)(Favourite(Circle(1.5))))
    println("Optional absent:  " + favouriteRadius.modify(_ * 10)(Favourite(Rectangle(2.0, 3.0))))
  }

  final case class Favourite(shape: Shape)
}
