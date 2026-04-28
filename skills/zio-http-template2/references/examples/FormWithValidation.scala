package example.template2

import zio._
import zio.http._
import zio.http.template2._

/**
 * Demonstrates form building with input validation, labels linked to inputs,
 * proper form structure, and Bootstrap-style classes.
 */
object FormWithValidationExample extends ZIOAppDefault {

  val page: Dom =
    html(
      head(
        meta(charset := "UTF-8"),
        meta(name := "viewport", content := "width=device-width, initial-scale=1"),
        title("Form Example"),
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
                  h4("User Registration")
                ),
                div(`class` := "card-body")(
                  form(
                    action := "/register",
                    method := "POST"
                  )(
                    // Username field
                    div(`class` := "mb-3")(
                      label(htmlFor := "username", `class` := "form-label")("Username"),
                      input(
                        `type` := "text",
                        `class` := "form-control",
                        id := "username",
                        name := "username",
                        placeholder := "Enter username",
                        required,
                        minlength := "3",
                        maxlength := "20"
                      )
                    ),
                    // Email field
                    div(`class` := "mb-3")(
                      label(htmlFor := "email", `class` := "form-label")("Email Address"),
                      input(
                        `type` := "email",
                        `class` := "form-control",
                        id := "email",
                        name := "email",
                        placeholder := "Enter email",
                        required
                      )
                    ),
                    // Password field
                    div(`class` := "mb-3")(
                      label(htmlFor := "password", `class` := "form-label")("Password"),
                      input(
                        `type` := "password",
                        `class` := "form-control",
                        id := "password",
                        name := "password",
                        placeholder := "Enter password",
                        required,
                        minlength := "8"
                      )
                    ),
                    // Confirm password field
                    div(`class` := "mb-3")(
                      label(htmlFor := "confirm-pwd", `class` := "form-label")("Confirm Password"),
                      input(
                        `type` := "password",
                        `class` := "form-control",
                        id := "confirm-pwd",
                        name := "confirm-password",
                        placeholder := "Confirm password",
                        required
                      )
                    ),
                    // Phone field (optional)
                    div(`class` := "mb-3")(
                      label(htmlFor := "phone", `class` := "form-label")("Phone (optional)"),
                      input(
                        `type` := "tel",
                        `class` := "form-control",
                        id := "phone",
                        name := "phone",
                        placeholder := "Enter phone number",
                        pattern := "[0-9\\-\\+\\(\\)\\s]{7,}"
                      )
                    ),
                    // Age field
                    div(`class` := "mb-3")(
                      label(htmlFor := "age", `class` := "form-label")("Age"),
                      input(
                        `type` := "number",
                        `class` := "form-control",
                        id := "age",
                        name := "age",
                        min := "18",
                        max := "120"
                      )
                    ),
                    // Country selector
                    div(`class` := "mb-3")(
                      label(htmlFor := "country", `class` := "form-label")("Country"),
                      select(
                        `class` := "form-select",
                        id := "country",
                        name := "country"
                      )(
                        option(value := "")("-- Select Country --"),
                        option(value := "us")("United States"),
                        option(value := "uk")("United Kingdom"),
                        option(value := "ca")("Canada"),
                        option(value := "au")("Australia")
                      )
                    ),
                    // Bio field (textarea)
                    div(`class` := "mb-3")(
                      label(htmlFor := "bio", `class` := "form-label")("Bio (optional)"),
                      textarea(
                        `class` := "form-control",
                        id := "bio",
                        name := "bio",
                        rows := "4",
                        placeholder := "Tell us about yourself"
                      )("")
                    ),
                    // Checkbox for terms
                    div(`class` := "mb-3", `form-check`)(
                      input(
                        `type` := "checkbox",
                        `class` := "form-check-input",
                        id := "terms",
                        name := "agree-terms",
                        value := "yes",
                        required
                      ),
                      label(htmlFor := "terms", `class` := "form-check-label")(
                        "I agree to the terms and conditions"
                      )
                    ),
                    // Radio buttons for newsletter
                    div(`class` := "mb-3")(
                      label("Subscribe to newsletter?"),
                      div(`class` := "form-check")(
                        input(
                          `type` := "radio",
                          `class` := "form-check-input",
                          id := "news-yes",
                          name := "newsletter",
                          value := "yes"
                        ),
                        label(htmlFor := "news-yes", `class` := "form-check-label")("Yes, subscribe me")
                      ),
                      div(`class` := "form-check")(
                        input(
                          `type` := "radio",
                          `class` := "form-check-input",
                          id := "news-no",
                          name := "newsletter",
                          value := "no",
                          checked
                        ),
                        label(htmlFor := "news-no", `class` := "form-check-label")("No, don't subscribe")
                      )
                    ),
                    // Submit button
                    div(`class` := ("d-grid", "gap-2"))(
                      button(
                        `type` := "submit",
                        `class` := ("btn", "btn-primary", "btn-lg")
                      )("Register")
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
