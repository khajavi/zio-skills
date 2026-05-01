package example.template2

import zio._
import zio.http._
import zio.http.template2._

/**
 * Demonstrates building reusable component functions:
 * - Card component with optional header/footer
 * - Button variants
 * - Form input wrapper component
 * - Page layout component
 */
object ReusableComponentsExample extends ZIOAppDefault {

  // ============================================================================
  // Reusable Components
  // ============================================================================

  /**
   * Card component that displays content in a card container.
   * Accepts optional title and footer.
   */
  def card(
    title: Option[String] = None,
    footer: Option[Dom] = None,
  )(content: Dom*): Dom.Element = {
    div(`class` := "card")(
      title.map(t => div(`class` := "card-header")(h5(t))),
      div(`class` := "card-body")(content),
      footer.map(f => div(`class` := "card-footer")(f))
    )
  }

  /**
   * Button component with variant styling.
   */
  def button(
    text: String,
    variant: String = "primary",
    size: String = "md",
    disabled: Boolean = false
  ): Dom.Element =
    button(
      `class` := (s"btn", s"btn-$variant", s"btn-$size"),
      if (disabled) Some(Dom.attr("disabled") := "") else None
    )(text)

  /**
   * Form input wrapper component with label.
   */
  def formInput(
    label: String,
    name: String,
    inputType: String = "text",
    placeholder: Option[String] = None,
    required: Boolean = false,
    helpText: Option[String] = None
  ): Dom.Element = {
    val input = input(
      `type` := inputType,
      `class` := "form-control",
      id := name,
      name := name,
      placeholder := placeholder.getOrElse("")
    ).when(required)(Dom.attr("required") := "")

    div(`class` := "form-group")(
      label(htmlFor := name, `class` := "form-label")(label),
      if (required) span(`class` := "text-danger")(" *") else Dom.empty,
      input,
      helpText.map(text => small(`class` := "form-text text-muted")(text))
    )
  }

  /**
   * Alert component for displaying messages.
   */
  def alert(
    message: String,
    alertType: String = "info",
    dismissible: Boolean = true
  ): Dom.Element = {
    div(`class` := (s"alert", s"alert-$alertType")).when(dismissible)(
      `class` := "alert-dismissible fade show"
    )(
      message,
      if (dismissible)
        button(
          `type` := "button",
          `class` := "btn-close",
          data("bs-dismiss") := "alert",
          ariaLabel := "Close"
        )
      else
        Dom.empty
    )
  }

  /**
   * Badge component for labels/tags.
   */
  def badge(text: String, variant: String = "default"): Dom.Element =
    span(`class` := (s"badge", s"badge-$variant"))(text)

  /**
   * Progress bar component.
   */
  def progressBar(percentage: Int, label: Option[String] = None): Dom.Element = {
    val percent = Math.min(100, Math.max(0, percentage))
    div(`class` := "progress")(
      div(
        `class` := "progress-bar",
        styleAttr := s"width: ${percent}%",
        role := "progressbar",
        ariaValueNow := percent.toString,
        ariaValueMin := "0",
        ariaValueMax := "100"
      )(label.map(l => s"$l ($percent%)"))
    )
  }

  /**
   * Page layout with header, sidebar, and main content.
   */
  def pageLayout(
    title: String,
    sidebar: Dom,
    main: Dom
  ): Dom.Element = {
    html(
      head(
        meta(charset := "UTF-8"),
        meta(name := "viewport", content := "width=device-width, initial-scale=1"),
        title(title),
        style.inlineCss(css"""
          body {
            display: grid;
            grid-template-columns: 200px 1fr;
            gap: 20px;
            padding: 20px;
            font-family: sans-serif;
          }
          .sidebar {
            background: #f5f5f5;
            padding: 20px;
            border-radius: 4px;
          }
          .main {
            background: white;
            padding: 20px;
            border-radius: 4px;
          }
        """)
      ),
      body(
        h1(title),
        div(
          div(`class` := "sidebar")(sidebar),
          div(`class` := "main")(main)
        )
      )
    )
  }

  // ============================================================================
  // Example Page Using Components
  // ============================================================================

  val examplePage: Dom =
    html(
      head(
        meta(charset := "UTF-8"),
        meta(name := "viewport", content := "width=device-width, initial-scale=1"),
        title("Component Examples"),
        link(
          rel := "stylesheet",
          href := "https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css"
        ),
        style.inlineCss(css"""
          body {
            padding: 20px;
            background-color: #f8f9fa;
          }
          .demo-section {
            margin-bottom: 30px;
          }
          .demo-section h2 {
            border-bottom: 2px solid #007bff;
            padding-bottom: 10px;
            margin-top: 30px;
          }
          .component-demo {
            background: white;
            padding: 15px;
            border-radius: 4px;
            margin: 10px 0;
          }
        """)
      ),
      body(
        div(`class` := "container")(
          h1("Template2 Reusable Components"),
          // Cards
          section(`class` := "demo-section")(
            h2("Card Components"),
            div(`class` := "row")(
              div(`class` := ("col-md-6", "component-demo"))(
                card(
                  title = Some("Simple Card"),
                )(
                  p("This is a simple card component."),
                  p("It can contain any content you want.")
                )
              ),
              div(`class` := ("col-md-6", "component-demo"))(
                card(
                  title = Some("Card with Footer"),
                  footer = Some(button("Action", variant = "primary"))
                )(
                  p("This card has a footer with an action button."),
                  p("Great for displaying options or calls to action.")
                )
              )
            )
          ),
          // Buttons
          section(`class` := "demo-section")(
            h2("Button Variants"),
            div(`class` := "component-demo")(
              div(
                button("Primary", variant = "primary"),
                " ",
                button("Secondary", variant = "secondary"),
                " ",
                button("Success", variant = "success"),
                " ",
                button("Danger", variant = "danger"),
                " ",
                button("Disabled", variant = "primary", disabled = true)
              )
            )
          ),
          // Alerts
          section(`class` := "demo-section")(
            h2("Alerts"),
            div(`class` := "component-demo")(
              alert("Info alert message", alertType = "info"),
              alert("Success message!", alertType = "success"),
              alert("Warning message", alertType = "warning"),
              alert("Error occurred", alertType = "danger")
            )
          ),
          // Badges
          section(`class` := "demo-section")(
            h2("Badges"),
            div(`class` := "component-demo")(
              p(
                badge("default"),
                " ",
                badge("Primary", variant = "primary"),
                " ",
                badge("Success", variant = "success"),
                " ",
                badge("Warning", variant = "warning"),
                " ",
                badge("Danger", variant = "danger")
              )
            )
          ),
          // Progress Bars
          section(`class` := "demo-section")(
            h2("Progress Bars"),
            div(`class` := "component-demo")(
              progressBar(25, Some("Loading")),
              progressBar(50, Some("Processing")),
              progressBar(100, Some("Complete"))
            )
          ),
          // Form Inputs
          section(`class` := "demo-section")(
            h2("Form Input Components"),
            div(`class` := "component-demo")(
              formInput(
                label = "Username",
                name = "username",
                placeholder = Some("Enter username"),
                required = true,
                helpText = Some("Choose a unique username")
              ),
              formInput(
                label = "Email",
                name = "email",
                inputType = "email",
                placeholder = Some("your@email.com"),
                required = true
              ),
              formInput(
                label = "Message",
                name = "message",
                inputType = "textarea",
                placeholder = Some("Enter your message"),
                helpText = Some("Max 500 characters")
              )
            )
          )
        ),
        script.externalJs("https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js")
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
