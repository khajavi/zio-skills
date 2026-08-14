package optics

/**
 * A `Prism` focuses on one case `A` of a sum type `S` that *may or may not* match — typically one branch of a sealed
 * trait, or a successful parse. It can try to extract the focus (`getOption`) and can always rebuild the whole from a
 * focus (`reverseGet`).
 *
 * Prism laws relate the two directions:
 *   - `getOption(reverseGet(a)) == Some(a)`
 *   - if `getOption(s) == Some(a)` then `reverseGet(a) == s`
 *
 * A typical use is safely accessing one branch of an ADT:
 *
 * {{{
 * sealed trait Shape
 * final case class Circle(radius: Double) extends Shape
 * final case class Square(side: Double)   extends Shape
 * val circle = Prism[Shape, Double](
 *   { case Circle(r) => Some(r); case _ => None },
 *   Circle(_),
 * )
 * circle.getOption(Circle(2.0)) // Some(2.0)
 * circle.getOption(Square(1.0)) // None
 * circle.modify(_ * 2)(Circle(2.0)) // Circle(4.0)
 * }}}
 *
 * @param getOption
 *   try to extract the focus from the whole
 * @param reverseGet
 *   rebuild the whole from a focus
 */
final case class Prism[S, A](getOption: S => Option[A], reverseGet: A => S) {

  /** True when the whole currently matches this prism's case. */
  def isMatching(s: S): Boolean = getOption(s).isDefined

  /** Update the focus if it matches; otherwise return `s` unchanged. */
  def modify(f: A => A): S => S = s => getOption(s).fold(s)(a => reverseGet(f(a)))

  /** Like [[modify]] but reports whether the update applied. */
  def modifyOption(f: A => A): S => Option[S] = s => getOption(s).map(a => reverseGet(f(a)))

  /** Compose with a deeper `Prism`; either case may fail to match. */
  def andThen[B](that: Prism[A, B]): Prism[S, B] = Prism(
    s => getOption(s).flatMap(that.getOption),
    b => reverseGet(that.reverseGet(b))
  )

  /** Compose with an [[Optional]] (or a [[Lens]] via [[Lens.asOptional]]). */
  def andThen[B](that: Optional[A, B]): Optional[S, B] = asOptional.andThen(that)

  /** Compose with a [[Lens]] focused inside the matched case. */
  def andThen[B](that: Lens[A, B]): Optional[S, B] = asOptional.andThen(that.asOptional)

  /**
   * Widen this `Prism` to an [[Optional]]. `set` replaces the focus only when the whole already matches this prism's
   * case.
   */
  def asOptional: Optional[S, A] = Optional(
    getOption,
    a => s => getOption(s).fold(s)(_ => reverseGet(a))
  )
}
