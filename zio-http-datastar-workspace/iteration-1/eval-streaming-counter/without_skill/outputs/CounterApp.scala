package example.datastar

import zio._
import zio.http._
import zio.http.datastar._
import zio.http.endpoint.Endpoint
import zio.http.template2._

object CounterApp extends ZIOAppDefault {

  val routes = Routes(
    // Main page route
    Method.GET / "" -> handler {
      Response(
        headers = Headers(
          Header.ContentType(MediaType.text.html),
        ),
        body = Body.fromCharSequence(indexPage.render),
      )
    },
    // SSE endpoint - streams counter updates every second
    Method.GET / "counter" -> events {
      handler {
        Ref.make(0).flatMap { counterRef =>
          counterRef.updateAndGet(_ + 1)
            .flatMap { count =>
              ServerSentEventGenerator.patchSignals(
                s"""{ "count": $count }""",
              )
            }
            .schedule(Schedule.spaced(1.second))
            .unit
        }
      }
    },
  )

  val $count = Signal[Int]("count")

  def indexPage = html(
    head(
      meta(charset("UTF-8")),
      meta(name("viewport"), content("width=device-width, initial-scale=1.0")),
      title("Live Counter - ZIO HTTP Datastar"),
      datastarScript,
      style.inlineCss(css),
    ),
    body(
      div(
        className := "container",
        h1("Live Counter"),
        div(
          id("counter-display"),
          dataSignals($count) := js"0",
          dataText := $count,
          // Auto-trigger the SSE endpoint on page load
          dataInit := Endpoint(Method.GET / "counter").out[String].datastarRequest(()),
        ),
        p(className := "subtitle", "Auto-increments every second"),
      ),
    ),
  )

  override def run =
    ZIO.logInfo("Starting server on http://localhost:8080") *>
      Server.serve(routes).provide(Server.default)

  val css = css"""
    body {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: system-ui, -apple-system, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      margin: 0;
      padding: 20px;
    }
    .container {
      text-align: center;
      background: white;
      border-radius: 10px;
      padding: 40px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      max-width: 500px;
      width: 100%;
    }
    h1 {
      font-size: 2.5rem;
      color: #333;
      margin: 0 0 40px 0;
    }
    #counter-display {
      font-size: 6rem;
      font-weight: bold;
      color: #667eea;
      font-family: 'Courier New', monospace;
      padding: 30px;
      background: #f0f4ff;
      border-radius: 8px;
      display: inline-block;
      min-width: 200px;
    }
    .subtitle {
      margin-top: 20px;
      color: #888;
      font-size: 1rem;
    }
    """
}
