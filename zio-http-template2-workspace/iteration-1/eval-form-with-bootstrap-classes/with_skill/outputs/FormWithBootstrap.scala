package example.template2

import zio._
import zio.http._
import zio.http.template2._

/**
 * Demonstrates building a professional form with Bootstrap CSS classes
 * and proper template2 patterns.
 *
 * Template2 Patterns Used:
 * 1. Multi-value attributes (className) with tuple syntax for Bootstrap classes
 * 2. Partial attributes using := operator for required values (id, name, type, placeholder, etc.)
 * 3. Boolean attributes for validation (required)
 * 4. Label-input linking with htmlFor and id attributes
 * 5. Void elements (input) with attributes only, no children
 * 6. Proper nesting: div wrapper, label, then input
 * 7. form element with POST action
 * 8. Mixing attributes and children in the same apply() call
 */
object FormWithBootstrap extends ZIOAppDefault {

  val page: Dom =
    html(
      head(
        meta(charset := "UTF-8"),
        meta(name := "viewport", content := "width=device-width, initial-scale=1"),
        title("Bootstrap Form Example"),
        link(
          rel := "stylesheet",
          href := "https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css"
        )
      ),
      body(
        div(`class` := ("container", "mt-5"))(
          div(`class` := ("row", "justify-content-center"))(
            div(`class` := ("col-md-6"))(
              div(`class` := "card")(
                div(`class` := "card-header")(
                  h4("User Information Form")
                ),
                div(`class` := "card-body")(
                  form(
                    action := "/submit",
                    method := "POST"
                  )(
                    // Username field group
                    div(`class` := "form-group")(
                      label(
                        htmlFor := "username",
                        `class` := "form-label"
                      )("Username"),
                      input(
                        `type` := "text",
                        `class` := "form-control",
                        id := "username",
                        name := "username",
                        placeholder := "Enter your username",
                        required,
                        minlength := "3",
                        maxlength := "20"
                      )
                    ),
                    // Email field group
                    div(`class` := "form-group")(
                      label(
                        htmlFor := "email",
                        `class` := "form-label"
                      )("Email"),
                      input(
                        `type` := "email",
                        `class` := "form-control",
                        id := "email",
                        name := "email",
                        placeholder := "Enter your email address",
                        required
                      )
                    ),
                    // Submit button
                    div(`class` := ("d-grid", "gap-2"))(
                      button(
                        `type` := "submit",
                        `class` := ("btn", "btn-primary")
                      )("Submit")
                    )
                  )
                )
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
          Response.html(page)
        }
      )
      .provide(Server.default)
}
