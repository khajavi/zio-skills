package example.datastar

import zio._
import zio.http._
import zio.http.datastar._
import zio.http.template2._

object SearchApp extends ZIOAppDefault {

  val routes: Routes[Any, Response] = Routes(
    // Main page route
    Method.GET / "" -> handler {
      Response(
        headers = Headers(
          Header.ContentType(MediaType.text.html),
        ),
        body = Body.fromCharSequence(indexPage.render),
      )
    },
    // SSE search endpoint - reads query from URL param
    Method.GET / "search" -> events {
      handler { (req: Request) =>
        val searchTerm = req.url.queryParameters.getAll("q").headOption
        val results = searchProducts(searchTerm)

        for {
          // First, replace the results container
          _ <- ServerSentEventGenerator.patchElements(
                 div(id("result"), ol(id("list")))
               )
          // Then append each result (100ms staggered for visual effect)
          _ <- ZIO.foreachDiscard(results) { r =>
                 ServerSentEventGenerator
                   .patchElements(
                     li(r),
                     PatchElementOptions(
                       selector = Some(CssSelector.id("list")),
                       mode = ElementPatchMode.Append,
                       useViewTransition = true,
                     ),
                   )
                   .delay(100.millis)
               }
        } yield ()
      }
    },
  )

  def indexPage = {
    html(
      head(
        meta(charset("UTF-8")),
        meta(name("viewport"), content("width=device-width, initial-scale=1.0")),
        title("Live Product Search - ZIO HTTP Datastar"),
        datastarScript,
        style.inlineCss(css),
      ),
      body(
        div(
          className := "container",
          h1("Product Search"),
          {
            val $query = Signal[String]("query")
            input(
              `type` := "text",
              placeholder := "Search for products...",
              name := "q",
              dataSignals($query) := "",
              dataBind($query.name),
              // Debounce by 300ms before sending request
              dataOn.input.debounce(300.millis) := js"@get('/search?q=' + ${$query})",
              autofocus,
            )
          },
          div(id("result")),
        ),
      ),
    )
  }

  def searchProducts(term: Option[String]): List[String] = {
    val products = List(
      // Fruits
      "Apple - Red delicious fruit",
      "Banana - Yellow tropical fruit",
      "Orange - Citrus fruit rich in vitamin C",
      "Mango - King of fruits",
      "Strawberry - Sweet red berries",
      "Grape - Small purple or green berries",
      "Watermelon - Large refreshing summer fruit",
      "Pineapple - Tropical fruit with spiky skin",
      "Peach - Soft fuzzy stone fruit",
      "Cherry - Small red stone fruit",
      // Books
      "The Great Gatsby - Classic American novel",
      "To Kill a Mockingbird - Timeless coming-of-age story",
      "1984 - Dystopian novel by George Orwell",
      "Pride and Prejudice - Jane Austen romance",
      "The Catcher in the Rye - J.D. Salinger classic",
      "Brave New World - Science fiction dystopia",
      "The Hobbit - Fantasy adventure by Tolkien",
      "Dune - Epic science fiction novel",
      // Electronics
      "Laptop - Portable computing device",
      "Monitor - Display screen for computers",
      "Keyboard - Input device for typing",
      "Mouse - Computer pointing device",
      "Headphones - Audio listening device",
      "Webcam - Video recording camera",
      "Speaker - Audio output device",
      "USB Hub - Multi-port connection device",
    )
    if (term.isEmpty) Nil
    else products.filter(_.toLowerCase.contains(term.get.toLowerCase))
  }

  override def run: ZIO[Any, Throwable, Unit] =
    ZIO.logInfo("Starting server on http://localhost:8080") *>
      Server
        .serve(routes)
        .provide(Server.default)

  val css = css"""
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 700px;
      margin: 50px auto;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
    }
    .container {
      background: white;
      border-radius: 10px;
      padding: 30px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    h1 {
      color: #333;
      margin-bottom: 30px;
    }
    input[type="text"] {
      width: 100%;
      padding: 12px;
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      font-size: 16px;
      box-sizing: border-box;
      margin-bottom: 20px;
    }
    input[type="text"]:focus {
      outline: none;
      border-color: #667eea;
    }
    #result {
      margin-top: 20px;
    }
    ol, ul {
      padding-left: 20px;
      list-style: none;
    }
    li {
      padding: 12px;
      margin: 8px 0;
      background: #f0f4ff;
      border-radius: 4px;
      border-left: 3px solid #667eea;
      transition: all 0.2s ease;
    }
    li:hover {
      background: #e8ecff;
      transform: translateX(4px);
    }
    """
}
