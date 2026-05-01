---
name: zio-http-datastar
description: >
  Use when asked to build a reactive web app with ZIO HTTP, add real-time updates
  or server-sent events (SSE) to a Scala server, stream HTML fragments to the browser,
  sync browser state with ZIO signals, build live-search, real-time clocks, typewriter
  effects, or multi-client chat with Datastar. Also use when replacing HTMX, AJAX,
  or React with server-driven HTML patching, or when using the Datastar SDK with Scala/ZIO HTTP.
tags: [zio, zio-http, datastar, sse, reactive, html, signals, streaming, scala]
---

# Build Reactive Web Apps with ZIO HTTP + Datastar

Use this skill when a user asks to:
- **Stream HTML updates** to the browser without JavaScript
- **Add real-time features** like live search, clocks, typewriter effects, or chat
- **Sync browser signals** with server-computed values
- **Replace HTMX or AJAX** with server-driven SSE updates
- **Build multi-client apps** where messages broadcast to all connected users
- **Integrate Datastar** with a ZIO HTTP server

---

## Step 1: Add the Dependency

Add `zio-http-datastar-sdk` to your `build.sbt`:

```scala
libraryDependencies ++= Seq(
  "dev.zio" %% "zio-http"             % "3.11.0",
  "dev.zio" %% "zio-http-datastar-sdk" % "3.11.0",
)
```

Include these three imports in any file using Datastar:

```scala
import zio.http._
import zio.http.datastar._
import zio.http.template2._
```

Key types:
- `import zio.http.template2._` provides the HTML DSL for generating typed DOM elements
- `import zio.http.datastar._` enables the `events` and `event` route wrappers plus all `data*` HTML attributes

---

## Step 2: Stream HTML to the Browser (The Core Pattern)

Datastar inverts the request/response cycle. The browser keeps an SSE connection open and the server pushes HTML fragments at will. Use the `events { handler { ... } }` route wrapper to stream updates:

```scala
import zio._
import zio.http._
import zio.http.datastar._
import zio.http.endpoint.Endpoint
import zio.http.template2._

object StreamingApp extends ZIOAppDefault {

  val routes = Routes(
    Method.GET / Root -> handler {
      Response(
        headers = Headers(Header.ContentType(MediaType.text.html)),
        body = Body.fromCharSequence(indexPage.render),
      )
    },
    Method.GET / "stream" -> events {
      handler {
        ZIO.foreachDiscard(1 to 5) { i =>
          ServerSentEventGenerator.patchElements(
            div(id("output"), s"Update $i of 5")
          ) *> ZIO.sleep(500.millis)
        }
      }
    },
  )

  val indexPage = html(
    head(title("Streaming Demo"), datastarScript),
    body(
      dataInit := Endpoint(Method.GET / "stream").out[String].datastarRequest(()),
      div(id("output"), "Waiting..."),
    ),
  )

  def run = Server.serve(routes).provide(Server.default)
}
```

Key types:
- `events { handler { ... } }` — streaming route wrapper; handler body is `ZIO[Datastar, Nothing, Unit]`
- `ServerSentEventGenerator.patchElements(dom)` — morphs the DOM in place; automatically finds element by `id`
- `datastarScript` — injects the Datastar JavaScript from CDN (version 1.0.1)
- `dataInit := Endpoint(...).out[String].datastarRequest(())` — auto-triggers the SSE endpoint when the page loads

⚠️ **Critical mistake to avoid**: The handler inside `events { handler { ... } }` must return `Unit`. All output happens via `ServerSentEventGenerator.*` methods. Attempting to return a `Response` will not compile.

---

## Step 3: Read Client Signals from the Request

Datastar sends the current signal state with every request. Two patterns work:

### Pattern A: URL Query Parameters (Simpler)

Pass data via the URL itself:

```scala
val $query = Signal[String]("query")

Routes(
  Method.GET / "search" -> events {
    handler { (req: Request) =>
      val term = req.url.queryParameters.getAll("q").headOption
      val results = filterResults(term)
      ServerSentEventGenerator.patchElements(
        div(id("results"), ol(id("list")), results.map(li(_)))
      )
    }
  },
)

// In your HTML:
input(
  `type` := "text",
  dataSignals($query) := "",
  dataBind($query.name),
  dataOn.input.debounce(300.millis) := js"@get('/search?q=' + ${$query})",
)
```

Key types:
- `Signal[String]("query")` — typed signal reference
- `dataSignals($signal) := ""` — declares signal in HTML with initial value
- `dataBind($signal.name)` — two-way binds input to signal
- `dataOn.input.debounce(300.millis)` — waits 300ms after typing stops, fires once
- `req.url.queryParameters.getAll(name)` — reads the URL param

### Pattern B: Type-Safe Request Body (Recommended)

Use `readSignals[T]` for larger forms:

```scala
case class SearchQuery(query: String)
object SearchQuery {
  implicit val schema = DeriveSchema.gen[SearchQuery]
}

Routes(
  Method.GET / "search" -> events {
    handler { (req: Request) =>
      for {
        params <- req.readSignals[SearchQuery].orElseSucceed(SearchQuery(""))
        results <- filterResults(params.query)
        _ <- ServerSentEventGenerator.patchElements(
               div(id("results"), results.map(li(_)))
             )
      } yield ()
    }
  },
)

// In your HTML:
input(
  `type` := "text",
  dataSignals($query) := "",
  dataBind($query.name),
  dataOn.input.debounce(300.millis) := js"@get('/search')",
)
```

Key types:
- `req.readSignals[T]` — `ZIO[Any, String, T]`; returns the current signal state as a typed object
- Case class must have `implicit val schema = DeriveSchema.gen[T]` (Scala 2) or `derives Schema` (Scala 3)
- `dataOn.input.debounce(300.millis) := js"@get('/search')"` — automatically includes all signals in the request

⚠️ **Common mistake**: Forgetting `dataSignals(...)` declaration. Without it, the signal is undefined on the client and `dataBind` silently fails.

---

## Step 4: Single-Shot Response with `event`

When you need exactly one DOM update (e.g., form submission), use `event { handler { ... } }` instead of `events`:

```scala
Routes(
  Method.GET / "greet" -> event {
    handler { (req: Request) =>
      DatastarEvent.patchElements(
        div(
          id("greeting"),
          p(s"Hello, ${req.queryParam("name").getOrElse("Guest")}!")
        )
      )
    }
  },
)

// In your HTML:
form(
  dataOn.submit := js"@get('/greet')",
  input(`type` := "text", name := "name", placeholder := "Your name"),
  button(`type` := "submit", "Greet me"),
)
div(id("greeting"))
```

Key types:
- `event { handler { ... } }` — single-shot route wrapper; handler returns `DatastarEvent`, not `ZIO`
- `DatastarEvent.patchElements(dom)` — returns a value (not an effect)
- `dataOn.submit` — no `.prevent` needed; Datastar prevents form default automatically

**When to use `event`**: Exactly one DOM patch in response to a single request. Use `events` for loops or streaming.

---

## Common Patterns

### Updating Signals Instead of DOM

For data-heavy updates (live clocks, progress), push a signal update instead of re-rendering HTML:

```scala
Method.GET / "server-time" -> events {
  handler {
    ZIO.clockWith(_.currentDateTime)
      .map { dt =>
        val time = dt.toLocalTime.format(DateTimeFormatter.ofPattern("HH:mm:ss"))
        s"{ 'currentTime': '$time' }"
      }
      .flatMap(ServerSentEventGenerator.patchSignals(_))
      .schedule(Schedule.spaced(1.second))
      .unit
  }
}

// In HTML:
val $time = Signal[String]("currentTime")
span(
  dataSignals($time) := "'--:--:--'",
  dataText := $time,
  dataInit := Endpoint(Method.GET / "server-time").out[String].datastarRequest(()),
)
```

Key types:
- `ServerSentEventGenerator.patchSignals(jsonString)` — updates browser signals (faster than DOM patching)
- `dataText := signal` — reactively displays signal value as element text

### Appending to Lists (Targeted Patching)

For live search results or chat messages, append without re-rendering the whole list:

```scala
ServerSentEventGenerator.patchElements(
  li("New item"),
  PatchElementOptions(
    selector = Some(CssSelector.id("my-list")),
    mode = ElementPatchMode.Append,
  ),
)
```

Key types:
- `PatchElementOptions(selector, mode)` — targets a CSS selector and specifies how to patch
- `ElementPatchMode.Append` — adds to the end; also: `Prepend`, `Inner` (replace contents), `Outer` (morph), `Before`, `After`, `Remove`

### Multi-Client Broadcasting with ZIO Hub

For chat or notifications, use a `Hub` to broadcast to all connected SSE clients:

```scala
case class ChatRoom(messages: Ref[List[String]], subscribers: Hub[String])

events {
  handler {
    for {
      messages <- ChatRoom.getMessages
      _ <- ServerSentEventGenerator.patchElements(
             messages.map(m => li(m)),
             PatchElementOptions(selector = Some(CssSelector.id("messages")), mode = ElementPatchMode.Inner),
           )
      stream <- ChatRoom.subscribe
      _ <- stream.mapZIO { msg =>
             ServerSentEventGenerator.patchElements(
               li(msg),
               PatchElementOptions(selector = Some(CssSelector.id("messages")), mode = ElementPatchMode.Append),
             )
           }.runDrain
    } yield ()
  }
}
```

See `references/examples/ChatServer.scala` for the full multi-file pattern with `ZIO.Hub`, service injection, and multi-user chat.

### Loading Indicators

Show/hide elements based on request state:

```scala
val $loading = Signal[Boolean]("loading")

button(
  dataIndicator($loading),  // sets $loading=true during request, false after
  dataOn.click := js"@get('/do-something')",
  "Do Something",
),
span(
  dataShow := js"${$loading}",
  "Loading...",
)
```

---

## Key Types

| Type / Function | Purpose |
|---|---|
| `events { handler { ... } }` | Streaming SSE route; handler is `ZIO[Datastar, Nothing, Unit]` |
| `event { handler { ... } }` | Single-shot route; handler returns `DatastarEvent` |
| `ServerSentEventGenerator.patchElements(dom)` | Stream DOM patch to client |
| `ServerSentEventGenerator.patchSignals(json)` | Stream signal update to client |
| `ServerSentEventGenerator.executeScript(js)` | Execute JavaScript on client |
| `DatastarEvent.patchElements(dom)` | Return DOM patch as value |
| `DatastarEvent.patchSignals[T: Schema](obj)` | Return signal update as value |
| `req.readSignals[T]` | Decode signal state from request (`ZIO[Any, String, T]`) |
| `Signal[A](name)` | Create typed signal reference |
| `dataSignals($s) := expr` | Declare signal in HTML with initial value |
| `dataBind($signal.name)` | Two-way bind input to signal |
| `dataOn.click := js"..."` | Attach action to event |
| `dataOn.input.debounce(ms)` | Debounce input events by milliseconds |
| `dataInit := request` | Fire request when page loads |
| `dataText := signal` | Display signal value as text |
| `dataShow := expr` | Show/hide element from expression |
| `dataIndicator($loading)` | Track loading state of a request |
| `Endpoint(...).out[T].datastarRequest(...)` | Render Datastar request from typed Endpoint |
| `PatchElementOptions(selector, mode)` | Target CSS selector and specify patch mode |

---

## Next Steps

- **Type-safe endpoints** — see `zio-http-imperative-to-declarative` for best practices on endpoint organization
- **OpenAPI docs** — see `zio-http-endpoint-to-openapi` to auto-generate documentation from endpoints
- **Full multi-client chat** — see `references/examples/ChatServer.scala` for complete Hub-based patterns
- **API reference** — see `references/api-guide.md` for the complete Datastar SDK

---

## References

- **[ZIO HTTP Datastar SDK](https://github.com/zio/zio-http/tree/main/zio-http-datastar-sdk)** — Source code
- **[Datastar Documentation](https://data-star.dev)** — Official docs
- **[ZIO HTTP Examples](https://github.com/zio/zio-http/tree/main/zio-http-example/src/main/scala/example/datastar)** — Working examples
- **[Maven Central](https://central.sonatype.com/artifact/dev.zio/zio-http-datastar-sdk_3)** — Dependency artifact
- **`references/api-guide.md`** — Complete API reference in this skill
