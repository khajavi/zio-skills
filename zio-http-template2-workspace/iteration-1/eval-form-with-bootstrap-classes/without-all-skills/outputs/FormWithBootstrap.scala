package example.template2

import zio._
import zio.http._
import zio.http.template2._

/**
 * Demonstrates a professional form with two inputs (username and email) using
 * Bootstrap CSS classes and proper HTML5 validation attributes.
 *
 * Key template2 patterns demonstrated:
 * - Multiple CSS classes using tuple syntax: `class` := ("form-group", "form-control")
 * - Label-input linking using htmlFor/id attributes
 * - Validation attributes: required, type, minlength, maxlength, pattern
 * - Form submission with method and action attributes
 * - Bootstrap 5 grid and styling for professional appearance
 */
object FormWithBootstrapExample extends ZIOAppDefault {

  val page: Dom =
    html(
      head(
        meta(charset := "UTF-8"),
        meta(name := "viewport", content := "width=device-width, initial-scale=1"),
        title("Form with Bootstrap Classes"),
        link(
          rel := "stylesheet",
          href := "https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css"
        )
      ),
      body(
        div(`class` := ("container", "mt-5"))(
          div(`class` := ("row", "justify-content-center"))(
            div(`class` := "col-md-6")(
              div(`class` := "card", styleAttr := "box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);")(
                div(`class` := "card-header", styleAttr := "background-color: #007bff; color: white;")(
                  h4(`class` := "mb-0")("User Registration Form")
                ),
                div(`class` := "card-body")(
                  form(
                    action := "/register",
                    method := "POST",
                    id := "registrationForm"
                  )(
                    // Username field with form-group and form-control classes
                    div(`class` := "form-group", styleAttr := "margin-bottom: 1.5rem;")(
                      label(
                        htmlFor := "username",
                        `class` := "form-label",
                        styleAttr := "font-weight: 600; margin-bottom: 0.5rem;"
                      )("Username"),
                      input(
                        `type` := "text",
                        `class` := "form-control",
                        id := "username",
                        name := "username",
                        placeholder := "Enter your username",
                        required,
                        minlength := "3",
                        maxlength := "20",
                        pattern := "^[a-zA-Z0-9_-]+$",
                        styleAttr := "border-radius: 4px; padding: 10px 12px;"
                      ),
                      small(`class` := "form-text text-muted", styleAttr := "display: block; margin-top: 0.25rem;")("3-20 characters, letters, numbers, hyphens and underscores only")
                    ),
                    // Email field with form-group and form-control classes
                    div(`class` := "form-group", styleAttr := "margin-bottom: 1.5rem;")(
                      label(
                        htmlFor := "email",
                        `class` := "form-label",
                        styleAttr := "font-weight: 600; margin-bottom: 0.5rem;"
                      )("Email Address"),
                      input(
                        `type` := "email",
                        `class` := "form-control",
                        id := "email",
                        name := "email",
                        placeholder := "Enter your email address",
                        required,
                        styleAttr := "border-radius: 4px; padding: 10px 12px;"
                      ),
                      small(`class` := "form-text text-muted", styleAttr := "display: block; margin-top: 0.25rem;")("We'll never share your email with anyone else")
                    ),
                    // Submit button
                    div(`class` := ("d-grid", "gap-2"), styleAttr := "margin-top: 2rem;")(
                      button(
                        `type` := "submit",
                        `class` := ("btn", "btn-primary", "btn-lg"),
                        styleAttr := "font-weight: 600; border-radius: 4px;"
                      )("Register Now")
                    ),
                    // Additional form message
                    div(
                      `class` := "alert alert-info",
                      styleAttr := "margin-top: 1.5rem; border-radius: 4px;",
                      role := "alert"
                    )(
                      small("By registering, you agree to our Terms of Service and Privacy Policy")
                    )
                  )
                )
              ),
              // Additional styling footer
              p(`class` := "text-center text-muted", styleAttr := "margin-top: 2rem; font-size: 0.9rem;")(
                "Already have an account? ",
                a(href := "/login", styleAttr := "color: #007bff; text-decoration: none;")("Sign in here")
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
