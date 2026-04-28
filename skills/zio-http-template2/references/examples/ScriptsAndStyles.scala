package example.template2

import zio._
import zio.http._
import zio.http.template2._

/**
 * Demonstrates script and style element patterns:
 * - Inline CSS with style.inlineCss()
 * - External stylesheets with link
 * - Inline JavaScript with script.inlineJs()
 * - External scripts with script.externalJs()
 * - ES6 modules with script.externalModule()
 * - Script attributes (async, defer, integrity, crossOrigin)
 */
object ScriptsAndStylesExample extends ZIOAppDefault {

  val page: Dom =
    html(
      head(
        meta(charset := "UTF-8"),
        meta(name := "viewport", content := "width=device-width, initial-scale=1"),
        title("Scripts and Styles Example"),
        // Inline CSS with css interpolator
        style.inlineCss(css"""
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
          }
          .container {
            background: white;
            border-radius: 8px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
            max-width: 600px;
            padding: 40px;
          }
          h1 {
            color: #333;
            margin-bottom: 10px;
            font-size: 2rem;
          }
          .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 1.1rem;
          }
          .demo-section {
            margin: 30px 0;
            padding: 20px;
            background: #f5f5f5;
            border-left: 4px solid #667eea;
            border-radius: 4px;
          }
          .demo-section h2 {
            color: #667eea;
            margin-bottom: 10px;
            font-size: 1.3rem;
          }
          .demo-section p {
            color: #555;
            line-height: 1.6;
            margin-bottom: 10px;
          }
          button {
            background: #667eea;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1rem;
            transition: background 0.3s ease;
          }
          button:hover {
            background: #764ba2;
          }
          .counter {
            display: inline-block;
            margin-left: 10px;
            background: #fff;
            color: #667eea;
            padding: 5px 15px;
            border-radius: 4px;
            font-weight: bold;
          }
          .hidden {
            display: none;
          }
        """),
        // External stylesheet
        link(
          rel := "stylesheet",
          href := "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css"
        )
      ),
      body(
        div(`class` := "container")(
          h1("Scripts and Styles Patterns"),
          p(`class` := "subtitle")("Examples of CSS and JavaScript integration"),
          // Demo 1: Interactive Button
          section(`class` := "demo-section")(
            h2("Interactive JavaScript"),
            p("Click the button to see JavaScript in action:"),
            button(
              `type` := "button",
              id := "counter-btn",
              data("action") := "increment"
            )("Click Me", span(`class` := "counter")("0"))
          ),
          // Demo 2: Hidden Content
          section(`class` := "demo-section")(
            h2("Show/Hide Toggle"),
            button(
              `type` := "button",
              id := "toggle-btn",
              data("target") := "#hidden-content"
            )("Show Details"),
            div(
              id := "hidden-content",
              `class` := "hidden"
            )(
              p("This content was hidden and can be toggled with JavaScript.")
            )
          ),
          // Demo 3: Form Validation
          section(`class` := "demo-section")(
            h2("Form with Client-Side Validation"),
            form(id := "demo-form")(
              div(
                label(htmlFor := "email")("Email:"),
                input(
                  `type` := "email",
                  id := "email",
                  name := "email",
                  required,
                  style := "width: 100%; padding: 5px; margin: 10px 0;",
                  placeholder := "Enter email"
                )
              ),
              div(
                button(`type` := "submit")("Submit")
              )
            )
          )
        ),
        // Inline JavaScript with js interpolator
        script.inlineJs(js"""
          // Counter functionality
          const counterBtn = document.getElementById('counter-btn');
          let count = 0;

          counterBtn.addEventListener('click', function() {
            count++;
            const counter = this.querySelector('.counter');
            counter.textContent = count;
            console.log('Button clicked! Count:', count);
          });

          // Toggle hidden content
          const toggleBtn = document.getElementById('toggle-btn');
          const hiddenContent = document.getElementById('hidden-content');

          toggleBtn.addEventListener('click', function() {
            hiddenContent.classList.toggle('hidden');
            this.textContent = hiddenContent.classList.contains('hidden') ? 'Show Details' : 'Hide Details';
          });

          // Form validation
          const form = document.getElementById('demo-form');
          form.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = document.getElementById('email').value;
            if (email.includes('@')) {
              alert('Form submitted with email: ' + email);
            } else {
              alert('Please enter a valid email');
            }
          });
        """),
        // External scripts
        script.externalJs("https://code.jquery.com/jquery-3.6.0.min.js"),
        // Async script
        script
          .externalJs("https://cdn.example.com/analytics.js")
          .async,
        // Deferred script with integrity check
        script
          .externalJs("https://cdn.example.com/tracking.js")
          .defer
          .integrity("sha384-SomeHashValue"),
        // Note: These external scripts are examples and may not exist
        // The script pattern below shows module script syntax
        script.externalModule("/js/app.js")
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
