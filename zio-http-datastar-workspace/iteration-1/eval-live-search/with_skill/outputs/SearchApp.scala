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
    // SSE search endpoint - reads query from URL param with debounce
    Method.GET / "search" -> events {
      handler { (req: Request) =>
        val searchTerm = req.url.queryParameters.getAll("q").headOption
        val results = searchProducts(searchTerm)

        for {
          // First, clear the results container and reset the list
          _ <- ServerSentEventGenerator.patchElements(
                 div(id("result"), ol(id("list")))
               )
          // Then append each result with a staggered effect for visual feedback
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
                   .delay(50.millis)
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
          h1("Product Finder"),
          p(className := "subtitle", "Search our catalog in real-time with 300ms debounce"),
          {
            val $query = Signal[String]("query")
            input(
              `type` := "text",
              placeholder := "Search products, books, or fruits...",
              name := "q",
              dataSignals($query) := "",
              dataBind($query.name),
              // Debounce by 300ms before sending search request
              dataOn.input.debounce(300.millis) := js"@get('/search?q=' + ${$query})",
              autofocus,
              className := "search-input",
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
      "Apple", "Banana", "Orange", "Mango", "Strawberry", "Grape",
      "Watermelon", "Pineapple", "Peach", "Cherry", "Pear", "Plum",
      "Kiwi", "Blueberry", "Raspberry", "Blackberry", "Lemon", "Lime",
      "Grapefruit", "Avocado", "Coconut", "Pomegranate", "Apricot",
      // Books
      "1984 by George Orwell", "To Kill a Mockingbird by Harper Lee",
      "The Great Gatsby by F. Scott Fitzgerald", "Pride and Prejudice by Jane Austen",
      "The Catcher in the Rye by J.D. Salinger", "Animal Farm by George Orwell",
      "Brave New World by Aldous Huxley", "The Hobbit by J.R.R. Tolkien",
      "The Lord of the Rings by J.R.R. Tolkien", "Dune by Frank Herbert",
      "Foundation by Isaac Asimov", "The Left Hand of Darkness by Ursula K. Le Guin",
      // Electronics & Gadgets
      "Laptop", "Smartphone", "Headphones", "Keyboard", "Mouse",
      "Monitor", "Webcam", "USB Cable", "Power Bank", "Tablet",
      "Smart Watch", "Wireless Charger", "SSD Drive", "RAM Module",
      // Home & Garden
      "Coffee Maker", "Toaster", "Microwave", "Blender", "Food Processor",
      "Vacuum Cleaner", "Desk Lamp", "Plant Pot", "Picture Frame", "Shower Curtain",
    )
    if (term.isEmpty) Nil
    else products.filter(_.toLowerCase.contains(term.get.toLowerCase))
  }

  override def run: ZIO[Any, Throwable, Unit] =
    Server
      .serve(routes)
      .provide(Server.default)

  val css = css"""
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container {
      background: white;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      width: 100%;
      max-width: 600px;
    }

    h1 {
      color: #2d3748;
      margin-bottom: 10px;
      font-size: 32px;
      font-weight: 700;
    }

    .subtitle {
      color: #718096;
      margin-bottom: 30px;
      font-size: 14px;
      font-weight: 500;
    }

    .search-input {
      width: 100%;
      padding: 14px 16px;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      font-size: 16px;
      margin-bottom: 24px;
      transition: all 0.2s ease;
      font-family: inherit;
    }

    .search-input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .search-input::placeholder {
      color: #cbd5e0;
    }

    #result {
      margin-top: 20px;
    }

    ol, ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    li {
      padding: 14px 16px;
      margin: 8px 0;
      background: #f7fafc;
      border-radius: 6px;
      border-left: 4px solid #667eea;
      color: #2d3748;
      font-size: 15px;
      transition: all 0.15s ease;
      animation: slideIn 0.2s ease;
    }

    li:hover {
      background: #edf2f7;
      transform: translateX(4px);
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(-10px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    /* Empty state styling */
    #result:empty::before {
      content: "Start typing to search...";
      display: block;
      color: #a0aec0;
      text-align: center;
      padding: 40px 20px;
      font-size: 14px;
      font-style: italic;
    }
    """
}
