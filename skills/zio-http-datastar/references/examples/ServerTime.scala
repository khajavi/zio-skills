package example.datastar

import java.time.format.DateTimeFormatter

import zio._
import zio.http._
import zio.http.datastar._
import zio.http.endpoint.Endpoint
import zio.http.template2._

object ServerTime extends ZIOAppDefault {

  private val timeFormatter = DateTimeFormatter.ofPattern("HH:mm:ss")

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
    // SSE endpoint - streams time updates every second
    Method.GET / "server-time" -> events {
      handler {
        ZIO.clockWith(_.currentDateTime)
          .map(_.toLocalTime.format(timeFormatter))
          .flatMap { currentTime =>
            ServerSentEventGenerator.patchSignals(
              s"""{ "currentTime": "$currentTime" }""",
              PatchSignalOptions(retryDuration = 5.seconds),
            )
          }
          .schedule(Schedule.spaced(1.second))
          .unit
      }
    },
  )

  def indexPage = html(
    head(
      meta(charset("UTF-8")),
      meta(name("viewport"), content("width=device-width, initial-scale=1.0")),
      title("Live Server Time - ZIO HTTP Datastar"),
      datastarScript,
      style.inlineCss(css),
    ),
    body(
      div(
        className := "container",
        h1("Live Server Time"),
        {
          val $currentTime = Signal[String]("currentTime")
          span(
            id("time-display"),
            dataSignals($currentTime) := js"'--:--:--'",
            dataText := $currentTime,
            // Auto-trigger the SSE endpoint on page load
            dataInit := Endpoint(Method.GET / "server-time").out[String].datastarRequest(()),
          )
        },
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
      max-width: 600px;
      width: 100%;
    }
    h1 {
      font-size: 2.5rem;
      color: #333;
      margin: 0 0 40px 0;
    }
    #time-display {
      font-size: 4rem;
      font-weight: bold;
      color: #667eea;
      font-family: 'Courier New', monospace;
      padding: 30px;
      background: #f0f4ff;
      border-radius: 8px;
      display: inline-block;
    }
    """
}
