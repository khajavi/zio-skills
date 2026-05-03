package example.cardcomponent

import zio._
import zio.http._
import zio.http.template2._

/**
 * Demonstrates a reusable card component function with:
 * - Optional title parameter
 * - Flexible content via varargs
 * - Optional footer parameter
 * - Conditional CSS class when starred=true
 * - Complete example application
 */
object CardComponentExample extends ZIOAppDefault {

  // ============================================================================
  // Card Component Function
  // ============================================================================

  /**
   * Reusable card component that displays content in a styled container.
   *
   * @param title Optional header title for the card
   * @param footer Optional footer content/element for the card
   * @param starred Whether the card is starred (adds 'card-highlighted' CSS class)
   * @param content Flexible content elements (varargs) for the card body
   * @return Dom.Element representing the card
   */
  def card(
    title: Option[String] = None,
    footer: Option[Dom] = None,
    starred: Boolean = false
  )(content: Dom*): Dom.Element = {
    div(
      `class` := (
        "card",
        if (starred) Some("card-highlighted") else None
      ).flatten
    )(
      // Optional title/header
      title.map(t =>
        div(`class` := "card-header")(
          h5(`class` := "card-title")(t)
        )
      ),
      // Card body with flexible content
      div(`class` := "card-body")(
        content
      ),
      // Optional footer
      footer.map(f =>
        div(`class` := "card-footer")(f)
      )
    )
  }

  // ============================================================================
  // Example Page with Various Card Component Demonstrations
  // ============================================================================

  val examplePage: Dom =
    html(
      head(
        meta(charset := "UTF-8"),
        meta(name := "viewport", content := "width=device-width, initial-scale=1"),
        title("Card Component Example"),
        style.inlineCss(css"""
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 20px;
            min-height: 100vh;
          }
          .container {
            max-width: 1200px;
            margin: 0 auto;
          }
          h1 {
            color: white;
            margin-bottom: 40px;
            text-align: center;
            font-size: 2.5rem;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
          }
          .cards-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 30px;
            margin-bottom: 40px;
          }
          .card {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            display: flex;
            flex-direction: column;
          }
          .card:hover {
            transform: translateY(-8px);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
          }
          .card-highlighted {
            border: 3px solid #ffd700;
            background: linear-gradient(to bottom, #fffacd 0%, white 10%, white 90%, #fffacd 100%);
            position: relative;
          }
          .card-highlighted::before {
            content: "⭐";
            position: absolute;
            top: 10px;
            right: 15px;
            font-size: 1.8rem;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          }
          .card-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            border-bottom: 1px solid #eee;
          }
          .card-title {
            color: white;
            margin: 0;
            font-size: 1.4rem;
            font-weight: 600;
          }
          .card-body {
            padding: 25px;
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 15px;
          }
          .card-body p {
            color: #555;
            line-height: 1.6;
            margin: 0;
            font-size: 0.95rem;
          }
          .card-body ul {
            color: #555;
            margin-left: 20px;
            line-height: 1.8;
          }
          .card-body li {
            margin-bottom: 8px;
          }
          .card-footer {
            background: #f8f9fa;
            padding: 15px 25px;
            border-top: 1px solid #eee;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
          }
          .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            font-size: 0.95rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-block;
          }
          .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          .btn-primary:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
          }
          .btn-secondary {
            background: #e9ecef;
            color: #333;
          }
          .btn-secondary:hover {
            background: #dee2e6;
          }
          .badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
            background: #e9ecef;
            color: #333;
          }
          .badge-success {
            background: #d4edda;
            color: #155724;
          }
          .badge-warning {
            background: #fff3cd;
            color: #856404;
          }
          .section-title {
            color: white;
            margin-bottom: 30px;
            font-size: 1.8rem;
            font-weight: 600;
            padding-bottom: 15px;
            border-bottom: 3px solid rgba(255, 255, 255, 0.3);
          }
          .demo-section {
            margin-bottom: 50px;
          }
        """)
      ),
      body(
        div(`class` := "container")(
          h1("Reusable Card Component"),
          // Section 1: Basic Cards
          div(`class` := "demo-section")(
            h2(`class` := "section-title")("Basic Cards"),
            div(`class` := "cards-grid")(
              card(
                title = Some("Simple Card")
              )(
                p("This is a basic card without a footer."),
                p("It contains flexible content passed as varargs.")
              ),
              card(
                title = Some("Card with Paragraph")
              )(
                p("Cards can contain multiple paragraphs."),
                p("Each element is passed individually to the card function."),
                p("The content is wrapped in a card-body div automatically.")
              ),
              card(
                title = Some("Card with List")
              )(
                p("Cards can contain any type of content:"),
                ul(
                  li("Paragraphs"),
                  li("Lists"),
                  li("Images"),
                  li("Forms"),
                  li("And more!")
                )
              )
            )
          ),
          // Section 2: Cards with Footers
          div(`class` := "demo-section")(
            h2(`class` := "section-title")("Cards with Footers"),
            div(`class` := "cards-grid")(
              card(
                title = Some("Action Card"),
                footer = Some(
                  button(`class` := "btn btn-primary")("Learn More")
                )
              )(
                p("This card has a footer with an action button."),
                p("Perfect for call-to-action elements.")
              ),
              card(
                title = Some("Multiple Actions"),
                footer = Some(
                  div(
                    button(`class` := "btn btn-primary")("Save"),
                    button(`class` := "btn btn-secondary")("Cancel")
                  )
                )
              )(
                p("The footer can contain multiple elements."),
                p("You can pass any Dom element to the footer parameter.")
              ),
              card(
                title = Some("Text Footer"),
                footer = Some(
                  p(`class` := "badge badge-success")("✓ Completed")
                )
              )(
                p("Footer content doesn't have to be buttons."),
                p("It can be text, badges, or any other HTML element.")
              )
            )
          ),
          // Section 3: Starred (Highlighted) Cards
          div(`class` := "demo-section")(
            h2(`class` := "section-title")("Starred / Highlighted Cards"),
            div(`class` := "cards-grid")(
              card(
                title = Some("Featured Card"),
                starred = true
              )(
                p("This card has the starred parameter set to true."),
                p("It displays the 'card-highlighted' CSS class automatically."),
                p("The star icon appears in the top-right corner.")
              ),
              card(
                title = Some("Highlighted with Footer"),
                footer = Some(
                  button(`class` := "btn btn-primary")("Premium Feature")
                ),
                starred = true
              )(
                p("Starred cards can also have footers."),
                p("Combine the starred flag with other parameters freely.")
              ),
              card(
                title = Some("Regular Card"),
                starred = false
              )(
                p("This card has starred=false (the default)."),
                p("It doesn't show the highlight styling or star icon.")
              )
            )
          ),
          // Section 4: Complex Content Cards
          div(`class` := "demo-section")(
            h2(`class` := "section-title")("Complex Content Examples"),
            div(`class` := "cards-grid")(
              card(
                title = Some("Product Card"),
                footer = Some(
                  div(
                    span(`class` := "badge")("$29.99"),
                    button(`class` := "btn btn-primary")("Add to Cart")
                  )
                ),
                starred = true
              )(
                p("Premium Wireless Headphones"),
                p("High-quality audio with active noise cancellation."),
                p("Perfect for music lovers and professionals."),
                div(
                  span(`class` := "badge badge-success")("In Stock"),
                  " ",
                  span(`class` := "badge badge-warning")("Limited Time")
                )
              ),
              card(
                title = Some("Blog Post"),
                footer = Some(
                  p(`class` := "badge")("Posted on April 28, 2026")
                )
              )(
                p("Introduction to ZIO Template2"),
                p("Learn how to build reusable components with ZIO HTTP template2. This comprehensive guide covers component composition, styling, and best practices."),
                p("By Milad Khajavi")
              ),
              card(
                title = Some("Testimonial"),
                footer = Some(
                  p(`class` := "badge")("⭐⭐⭐⭐⭐")
                ),
                starred = true
              )(
                p("\"This framework makes building web components incredibly easy and intuitive.\""),
                p("- Happy Developer")
              )
            )
          ),
          // Section 5: Empty and Edge Cases
          div(`class` := "demo-section")(
            h2(`class` := "section-title")("Edge Cases"),
            div(`class` := "cards-grid")(
              card()(
                p("Card without a title - just content.")
              ),
              card(
                title = Some("Card with Empty Body")
              )(),
              card(
                title = Some("Minimal Card"),
                footer = Some(p("Footer only"))
              )(
                p("Minimal content example.")
              )
            )
          )
        )
      )
    )

  override def run: ZIO[Any, Throwable, Unit] =
    Server
      .serve(
        Method.GET / Root -> handler {
          Response.html(examplePage)
        }
      )
      .provide(Server.default)
}
