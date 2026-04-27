package example.datastar

import zio._
import zio.http._
import zio.http.datastar._
import zio.http.template2._

object GreetingApp extends ZIOAppDefault {

  val routes: Routes[Any, Response] = Routes(
    // Serve the HTML page
    Method.GET / "" -> event {
      handler { (_: Request) =>
        DatastarEvent.patchElements(indexPage)
      }
    },
    // Handle form submission - single-shot response
    Method.GET / "greet" -> event {
      handler { (req: Request) =>
        val name = req.queryParam("name").getOrElse("Guest")
        DatastarEvent.patchElements(
          div(
            id("greeting"),
            p(s"Hello, $name! Welcome to our app."),
          ),
        )
      }
    },
  )

  def indexPage = html(
    head(
      meta(charset("UTF-8")),
      meta(name("viewport"), content("width=device-width, initial-scale=1.0")),
      title("Greeting Form - ZIO HTTP Datastar"),
      datastarScript,
      style.inlineCss(css),
    ),
    body(
      div(
        className := "container",
        h1("Welcome!"),
        p("Enter your name and click Submit to receive a personalized greeting."),
        form(
          id("greetingForm"),
          // dataOn.submit auto-prevents form submission and fires the action
          dataOn.submit := js"@get('/greet')",
          div(
            className := "form-group",
            label(
              `for`("nameInput"),
              "Your Name:",
            ),
            input(
              `type`("text"),
              id("nameInput"),
              name("name"),
              placeholder("Enter your name"),
              required,
              autofocus,
            ),
          ),
          button(
            `type`("submit"),
            className := "submit-btn",
            "Submit",
          ),
        ),
        div(id("greeting"), className := "greeting-container"),
      ),
    ),
  )

  val css = css"""
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 600px;
      margin: 50px auto;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
    }
    .container {
      background: white;
      border-radius: 10px;
      padding: 40px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    h1 {
      color: #333;
      margin-bottom: 10px;
      font-size: 28px;
    }
    p {
      color: #666;
      margin-bottom: 30px;
      line-height: 1.6;
    }
    form {
      display: flex;
      flex-direction: column;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      color: #555;
      font-weight: 600;
      font-size: 14px;
    }
    input[type="text"] {
      width: 100%;
      padding: 12px 14px;
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      font-size: 16px;
      box-sizing: border-box;
      transition: border-color 0.3s ease;
    }
    input[type="text"]:focus {
      outline: none;
      border-color: #667eea;
    }
    .submit-btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 24px;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    .submit-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
    }
    .submit-btn:active {
      transform: translateY(0);
    }
    .greeting-container {
      margin-top: 30px;
    }
    #greeting {
      padding: 20px;
      background: #f0f4ff;
      border-left: 4px solid #667eea;
      border-radius: 6px;
      font-size: 18px;
      color: #333;
      animation: slideIn 0.4s ease;
    }
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    #greeting:empty {
      display: none;
    }
    """

  override def run: ZIO[Any, Throwable, Unit] =
    Server
      .serve(routes)
      .provide(Server.default)
