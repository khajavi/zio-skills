package example.datastar

import zio._
import zio.http._
import zio.http.datastar._
import zio.http.endpoint.Endpoint
import zio.http.template2._

object CounterApp extends ZIOAppDefault {

  val routes: Routes[Any, Response] = Routes(
    Method.GET / Root -> handler {
      Response(
        headers = Headers(Header.ContentType(MediaType.text.html)),
        body = Body.fromCharSequence(indexPage.render),
      )
    },
    Method.GET / "counter" -> events {
      handler {
        ZIO.foreachDiscard(LazyList.from(0)) { count =>
          ServerSentEventGenerator.patchElements(
            div(id("counter"), count.toString)
          ) *> ZIO.sleep(1.second)
        }
      }
    },
  )

  def indexPage = html(
    head(
      meta(charset("UTF-8")),
      meta(name("viewport"), content("width=device-width, initial-scale=1.0")),
      title("Live Counter - ZIO HTTP + Datastar"),
      datastarScript,
      style.inlineCss(css),
    ),
    body(
      dataInit := Endpoint(Method.GET / "counter").out[String].datastarRequest(()),
      div(
        className := "container",
        h1("Live Counter"),
        p(className := "subtitle", "Auto-increments every second"),
        div(id("counter"), className := "counter-display", "0"),
      ),
    ),
  )

  override def run: ZIO[Any, Throwable, Unit] =
    Server
      .serve(routes)
      .provide(Server.default)

  val css = css"""
    body {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: system-ui, -apple-system, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      margin: 0;
      padding: 20px;
    }
    .container {
      text-align: center;
      background: white;
      border-radius: 16px;
      padding: 48px 64px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.4);
      max-width: 480px;
      width: 100%;
    }
    h1 {
      font-size: 2.5rem;
      color: #1a1a2e;
      margin-bottom: 8px;
      margin-top: 0;
    }
    .subtitle {
      font-size: 1rem;
      color: #888;
      margin-bottom: 40px;
      margin-top: 0;
    }
    #counter {
      font-size: 6rem;
      font-weight: 700;
      color: #0f3460;
      background: #f0f4ff;
      border-radius: 12px;
      padding: 24px 40px;
      min-width: 160px;
      display: inline-block;
      border: 3px solid #d0d8ff;
      letter-spacing: -2px;
    }
    """
}
