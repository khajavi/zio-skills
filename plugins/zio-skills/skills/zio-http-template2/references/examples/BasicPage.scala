package example.template2

import zio._
import zio.http._
import zio.http.template2._

/**
 * Demonstrates basic template2 patterns: various element types, nesting,
 * and simple attribute usage.
 */
object BasicPageExample extends ZIOAppDefault {

  val page: Dom =
    html(
      head(
        meta(charset := "UTF-8"),
        meta(name := "viewport", content := "width=device-width, initial-scale=1"),
        title("Basic Page Example")
      ),
      body(
        // Header section
        header(
          h1("Welcome to ZIO HTTP Template2"),
          p("A type-safe HTML DSL for Scala")
        ),
        // Main content
        main(
          // Text content
          section(
            h2("Text Elements"),
            p(
              "This is a paragraph. ",
              strong("This is strong text."),
              " And ",
              em("this is emphasized."),
              " You can also use ",
              code("inline code"),
              "."
            ),
            blockquote("This is a block quote with multiple lines of content.")
          ),
          // Lists
          section(
            h2("Lists"),
            h3("Unordered List"),
            ul(
              li("First item"),
              li("Second item"),
              li("Third item")
            ),
            h3("Ordered List"),
            ol(
              li("Step one"),
              li("Step two"),
              li("Step three")
            )
          ),
          // Table
          section(
            h2("Table Example"),
            table(
              thead(
                tr(
                  th("Name"),
                  th("Age"),
                  th("City")
                )
              ),
              tbody(
                tr(
                  td("Alice"),
                  td("30"),
                  td("New York")
                ),
                tr(
                  td("Bob"),
                  td("25"),
                  td("San Francisco")
                ),
                tr(
                  td("Charlie"),
                  td("35"),
                  td("Chicago")
                )
              )
            )
          ),
          // Links and images
          section(
            h2("Links and Images"),
            p(
              a(href := "https://example.com")("Visit Example.com")
            ),
            p(
              img(
                src := "https://via.placeholder.com/300",
                alt := "Placeholder image"
              )
            )
          ),
          // Semantic content
          section(
            h2("Semantic Elements"),
            article(
              h3("Article Title"),
              p("Article content goes here..."),
              small("Published on 2024-01-01")
            ),
            aside(
              h3("Related Links"),
              ul(
                li(a(href := "#")("Link 1")),
                li(a(href := "#")("Link 2"))
              )
            )
          )
        ),
        // Footer
        footer(
          p("© 2024 ZIO HTTP Examples")
        )
      )
    )

  override def run: ZIO[Any, Throwable, Unit] =
    Server
      .serve(
        Method.GET / Root -> handler {
          Response.html(page)
        }
      )
      .provide(Server.default)
}
