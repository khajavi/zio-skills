import zio.http.template2._

/**
 * CardComponent demonstrates a reusable, flexible card component built with template2.
 * Shows how to create components with:
 * - Optional title parameter using Option pattern
 * - Optional footer parameter using Option pattern
 * - Flexible content via varargs (Dom*)
 * - Conditional CSS classes using .when() for 'starred' parameter
 * - Composable component patterns
 */
object CardComponent:

  /**
   * Reusable card component function
   *
   * @param title      Optional title text to display at the top of the card
   * @param footer     Optional footer content (Dom element) to display at the bottom
   * @param starred    If true, adds 'card-highlighted' CSS class for styling
   * @param content    Flexible varargs for card body content (one or more Dom elements)
   * @return Dom.Element representing the card
   */
  def card(
    title: Option[String] = None,
    footer: Option[Dom] = None,
    starred: Boolean = false
  )(content: Dom*): Dom.Element =
    div(
      // Conditional className: when starred=true, include 'card-highlighted'
      className := (
        if (starred) ("card", "card-highlighted")
        else ("card",)
      )
    )(
      // Optional title section - renders only if title is Some
      title.map(t =>
        div(`class` := "card-header")(
          h5(`class` := "card-title")(t)
        )
      ),
      // Card body - always renders with flexible content
      div(`class` := "card-body")(
        content
      ),
      // Optional footer section - renders only if footer is Some
      footer.map(f =>
        div(`class` := "card-footer")(f)
      )
    )

  /**
   * Alternative implementation using .when() for conditional attributes
   * This demonstrates the recommended pattern for conditional classes
   */
  def cardWithWhen(
    title: Option[String] = None,
    footer: Option[Dom] = None,
    starred: Boolean = false
  )(content: Dom*): Dom.Element =
    div(`class` := "card")
      .when(starred)(
        className := ("card", "card-highlighted")
      )(
        // Optional title
        title.map(t =>
          div(`class` := "card-header")(
            h5(`class` := "card-title")(t)
          )
        ),
        // Card body with flexible content
        div(`class` := "card-body")(content),
        // Optional footer
        footer.map(f =>
          div(`class` := "card-footer")(f)
        )
      )

  // ==================== Example Usage ====================

  def main(args: Array[String]): Unit =
    // Inline CSS for demonstration
    val styles = style.inlineCss(css"""
      body {
        font-family: sans-serif;
        background-color: #f5f5f5;
        padding: 20px;
        margin: 0;
      }

      .container {
        max-width: 1200px;
        margin: 0 auto;
      }

      .card {
        background-color: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        margin-bottom: 20px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }

      .card-header {
        background-color: #f8f9fa;
        padding: 12px 16px;
        border-bottom: 1px solid #ddd;
      }

      .card-title {
        margin: 0;
        font-size: 18px;
        color: #333;
        font-weight: 600;
      }

      .card-body {
        padding: 16px;
        color: #666;
        line-height: 1.6;
      }

      .card-footer {
        background-color: #f8f9fa;
        padding: 12px 16px;
        border-top: 1px solid #ddd;
        text-align: right;
      }

      /* Highlight class - applied when starred=true */
      .card-highlighted {
        border: 2px solid #ffc107;
        box-shadow: 0 0 8px rgba(255, 193, 7, 0.3);
        background-color: #fffef5;
      }

      .card-highlighted .card-header {
        background-color: #fff9e6;
      }

      h1 {
        color: #333;
        margin-bottom: 30px;
      }

      h2 {
        color: #666;
        margin-top: 30px;
        margin-bottom: 15px;
        font-size: 20px;
      }

      .btn {
        display: inline-block;
        padding: 8px 16px;
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        text-decoration: none;
        font-size: 14px;
      }

      .btn:hover {
        background-color: #0056b3;
      }

      .btn-secondary {
        background-color: #6c757d;
      }

      .btn-secondary:hover {
        background-color: #545b62;
      }

      .demo-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
      }
    """)

    // Example 1: Card with title, content, and footer
    val basicCard = card(
      title = Some("User Profile"),
      footer = Some(button(`class` := "btn")("Edit Profile"))
    )(
      p("Name: John Doe"),
      p("Email: john.doe@example.com"),
      p("Location: San Francisco, CA")
    )

    // Example 2: Card with only content (no title or footer)
    val minimalCard = card()(
      p("This is a simple card with just content."),
      p("No title, no footer - very minimal.")
    )

    // Example 3: Starred (highlighted) card with title
    val starredCard = card(
      title = Some("Featured Product"),
      starred = true
    )(
      p("Premium Item"),
      p("Price: $99.99"),
      p("⭐ Customer favorite - 4.8/5 stars")
    )

    // Example 4: Starred card with all features
    val complexCard = card(
      title = Some("Project Alpha"),
      footer = Some(
        div(
          button(`class` := ("btn", "btn-secondary"), style := "margin-right: 8px")("View Details"),
          button(`class` := "btn")("Start Now")
        )
      ),
      starred = true
    )(
      p("High-priority initiative launching Q2 2026"),
      p("Team: 5 engineers, 2 designers"),
      p("Status: In Progress - 60% complete")
    )

    // Example 5: Card with multiple content elements
    val multiContentCard = card(
      title = Some("Blog Post")
    )(
      p("Published on April 28, 2026"),
      h3("Building Scalable Web Applications with ZIO"),
      p(
        "This article explores best practices for building reactive, "
        + "type-safe web applications using the ZIO ecosystem."
      ),
      p("Read time: 8 minutes")
    )

    // Example 6: Card demonstrating Option.map for footer content
    val optionalFooterCard: Boolean => Dom.Element = isAdmin =>
      val footerContent: Option[Dom] =
        if (isAdmin)
          Some(
            div(
              button(`class` := "btn")("Admin Panel"),
              button(`class` := ("btn", "btn-secondary"))("Delete")
            )
          )
        else None

      card(
        title = Some("Resource"),
        footer = footerContent
      )(
        p("Public resource accessible to all users"),
        p("Type: Documentation"),
        p("Last updated: April 2026")
      )

    // Example 7: Using cardWithWhen alternative pattern
    val whenPatternCard = cardWithWhen(
      title = Some("VIP Account"),
      footer = Some(button(`class` := "btn")("Manage Subscription")),
      starred = true
    )(
      p("Premium subscriber"),
      p("Next billing date: May 28, 2026"),
      p("Features: Unlimited access, Priority support")
    )

    // Render the complete page with all examples
    val page: Dom =
      html(
        head(
          title("Card Component Examples"),
          styles
        ),
        body(
          div(`class` := "container")(
            h1("Template2 Card Component Examples"),
            p(
              "Demonstrating a reusable, flexible card component with "
              + "optional title, flexible content, optional footer, and conditional styling."
            ),

            h2("Example 1: Basic Card with Title and Footer"),
            basicCard,

            h2("Example 2: Minimal Card"),
            minimalCard,

            h2("Example 3: Starred (Highlighted) Card"),
            starredCard,

            h2("Example 4: Complex Card with All Features"),
            complexCard,

            h2("Example 5: Card with Multiple Content Elements"),
            multiContentCard,

            h2("Example 6: Admin Card (Conditional Footer)"),
            optionalFooterCard(true),

            h2("Example 6b: User Card (No Admin Footer)"),
            optionalFooterCard(false),

            h2("Example 7: Using .when() Pattern for Conditional Classes"),
            whenPatternCard,

            h2("Key Implementation Details"),
            div(
              p(
                "✓ card() function returns Dom.Element"
              ),
              p(
                "✓ Accepts varargs (Dom*) for flexible children content"
              ),
              p(
                "✓ Optional title parameter uses Option[String]"
              ),
              p(
                "✓ Optional footer parameter uses Option[Dom]"
              ),
              p(
                "✓ Conditional className when starred=true adds 'card-highlighted' class"
              ),
              p(
                "✓ Uses Option.map for optional title and footer rendering"
              ),
              p(
                "✓ Demonstrates .when() for alternative conditional attribute pattern"
              )
            )
          )
        )
      )

    // Print the rendered HTML
    println(page.render(indentation = true))
    println("\n\n=== Successfully compiled and rendered CardComponent ===\n")
