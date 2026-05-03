package example.template2

import zio._
import zio.http._
import zio.http.template2._

/**
 * Demonstrates a professional form with Bootstrap CSS classes and validation attributes.
 * Features:
 * - Username field with label, required validation, and minlength/maxlength constraints
 * - Email field with label, required validation, and email type validation
 * - Bootstrap form-group, form-label, and form-control classes applied correctly
 * - Professional styling with Bootstrap CDN
 * - Proper form structure and accessibility
 */
object FormWithBootstrapClasses extends ZIOAppDefault {

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
            div(`class` := ("col-md-6"))(
              div(`class` := "card", style := "box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);")(
                div(`class` := ("card-header", "bg-primary", "text-white"))(
                  h4(`class` := "mb-0")("User Information Form")
                ),
                div(`class` := "card-body")(
                  form(
                    action := "/submit",
                    method := "POST"
                  )(
                    // Username field with Bootstrap styling
                    div(`class` := "mb-3")(
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
                    // Email field with Bootstrap styling
                    div(`class` := "mb-3")(
                      label(
                        htmlFor := "email",
                        `class` := "form-label"
                      )("Email Address"),
                      input(
                        `type` := "email",
                        `class` := "form-control",
                        id := "email",
                        name := "email",
                        placeholder := "Enter your email address",
                        required
                      )
                    ),
                    // Submit button with Bootstrap styling
                    div(`class` := ("d-grid", "gap-2"))(
                      button(
                        `type` := "submit",
                        `class` := ("btn", "btn-primary", "btn-lg")
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
        Routes(
          Method.GET / Root -> handler {
            Response.html(page)
          },
          Method.POST / "submit" -> handler { (request: Request) =>
            // Handle form submission
            request.body.asString.map { bodyStr =>
              Response.text(s"Form submission received. Data: $bodyStr").withStatus(Status.Ok)
            }
          }
        )
      )
      .provide(Server.default)
}
