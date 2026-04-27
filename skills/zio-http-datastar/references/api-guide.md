# Datastar SDK API Reference

Complete reference for the ZIO HTTP Datastar SDK (`zio-http-datastar-sdk`).

## Dependency and Imports

```scala
libraryDependencies += "dev.zio" %% "zio-http-datastar-sdk" % "3.11.0"
```

Required imports:

```scala
import zio.http._                   // HTTP types, Response, Request, Routes
import zio.http.datastar._          // events, event, signals, ServerSentEventGenerator
import zio.http.template2._         // HTML DSL (div, p, input, etc.)
import zio.schema._                 // Schema derivation
```

---

## Route Wrappers

| Wrapper | Return Type | When to Use | Handler Body |
|---------|-------------|------------|--------------|
| `events { handler { ... } }` | `ZIO[Datastar, Nothing, Unit]` | Streaming SSE; loops, schedules | Side effects via `ServerSentEventGenerator.*` |
| `event { handler { ... } }` | `DatastarEvent` | Single-shot response | Return `DatastarEvent.*` values |

**Handler signatures:**

```scala
// events wrapper - handler takes Request, returns Unit
events {
  handler { (req: Request) =>
    ServerSentEventGenerator.patchElements(...) *> ZIO.sleep(100.millis)
  }
}

// event wrapper - handler takes Request, returns DatastarEvent
event {
  handler { (req: Request) =>
    DatastarEvent.patchElements(div(id("out"), "Done"))
  }
}
```

---

## ServerSentEventGenerator (Streaming API)

All methods return `ZIO[Datastar, Nothing, Unit]`. Use inside `events { handler { ... } }`.

### Patch Elements (DOM morphing)

```scala
def patchElements(dom: Dom): ZIO[Datastar, Nothing, Unit]
def patchElements(dom: Dom, options: PatchElementOptions): ZIO[Datastar, Nothing, Unit]
def patchElements(elements: Iterable[Dom]): ZIO[Datastar, Nothing, Unit]
def patchElements(elements: Iterable[Dom], options: PatchElementOptions): ZIO[Datastar, Nothing, Unit]
def patchElements(htmlString: String): ZIO[Datastar, Nothing, Unit]
def patchElements(htmlString: String, options: PatchElementOptions): ZIO[Datastar, Nothing, Unit]
```

**Examples:**

```scala
// Simple patch (finds element by id)
ServerSentEventGenerator.patchElements(div(id("output"), "Updated"))

// Target specific selector
ServerSentEventGenerator.patchElements(
  li("New item"),
  PatchElementOptions(
    selector = Some(CssSelector.id("my-list")),
    mode = ElementPatchMode.Append,
  ),
)
```

### Patch Signals (Update reactive variables)

```scala
def patchSignals(signal: String): ZIO[Datastar, Nothing, Unit]
def patchSignals(signal: String, options: PatchSignalOptions): ZIO[Datastar, Nothing, Unit]
def patchSignals(signals: Iterable[String]): ZIO[Datastar, Nothing, Unit]
def patchSignals(signals: Iterable[String], options: PatchSignalOptions): ZIO[Datastar, Nothing, Unit]
```

**Examples:**

```scala
// Update a single signal via JSON string
ServerSentEventGenerator.patchSignals("""{ "count": 42 }""")

// Update multiple signals
ServerSentEventGenerator.patchSignals(Seq(
  """{ "count": 42 }""",
  """{ "status": "active" }""",
))

// With options
ServerSentEventGenerator.patchSignals(
  """{ "currentTime": "14:35:20" }""",
  PatchSignalOptions(retryDuration = 5.seconds),
)
```

### Execute JavaScript

```scala
def executeScript(script: Js): ZIO[Datastar, Nothing, Unit]
def executeScript(script: Js, options: ExecuteScriptOptions): ZIO[Datastar, Nothing, Unit]
def executeScript(script: String): ZIO[Datastar, Nothing, Unit]
def executeScript(script: Dom.Element.Script): ZIO[Datastar, Nothing, Unit]
```

**Examples:**

```scala
ServerSentEventGenerator.executeScript(js"console.log('Hello')")
ServerSentEventGenerator.executeScript("alert('Welcome')")
```

### Dispatch DOM Events

```scala
def dispatchEvent[T <: Product: Schema](eventName: String, payload: T): ZIO[Datastar, Nothing, Unit]
def dispatchEvent[T <: Product: Schema](eventName: String, payload: T, options: DispatchEventOptions): ZIO[Datastar, Nothing, Unit]
def dispatchEvent(eventName: String, payload: Js): ZIO[Datastar, Nothing, Unit]
```

**Example:**

```scala
case class ItemAdded(id: String, name: String) derives Schema

ServerSentEventGenerator.dispatchEvent("item-added", ItemAdded("123", "Widget"))
```

---

## DatastarEvent (Single-Shot API)

All methods return values (not effects). Use inside `event { handler { ... } }`.

```scala
DatastarEvent.patchElements(dom: Dom): DatastarEvent
DatastarEvent.patchElements(dom: Dom, options: PatchElementOptions): DatastarEvent
DatastarEvent.patchElements(htmlString: String): DatastarEvent

DatastarEvent.patchSignals[T <: Product: Schema](obj: T): DatastarEvent
DatastarEvent.patchSignals(signals: Map[String, String]): DatastarEvent

DatastarEvent.executeScript(js: Js): DatastarEvent
DatastarEvent.executeScript(script: String): DatastarEvent

DatastarEvent.dispatchEvent[T <: Product: Schema](eventName: String, payload: T): DatastarEvent
```

**Example:**

```scala
event {
  handler { (req: Request) =>
    DatastarEvent.patchElements(
      div(id("greeting"), p(s"Hello, ${req.queryParam("name").getOrElse("Guest")}"))
    )
  }
}
```

---

## Options Types

### PatchElementOptions

```scala
final case class PatchElementOptions(
  selector: Option[CssSelector] = None,          // CSS selector to target
  mode: ElementPatchMode = ElementPatchMode.Outer, // how to apply patch
  useViewTransition: Boolean = false,            // enable view transitions
  namespace: Option[String] = None,
  eventId: Option[String] = None,
  retryDuration: Duration = 1000.millis,        // retry on network failure
)
```

**ElementPatchMode** (sealed trait):
- `Outer` — morph the element in place (default)
- `Inner` — replace element contents
- `Replace` — replace the element entirely
- `Prepend` — add before the element
- `Append` — add after the element
- `Before` — insert before the element
- `After` — insert after the element
- `Remove` — remove the element

### PatchSignalOptions

```scala
final case class PatchSignalOptions(
  onlyIfMissing: Boolean = false,     // only update if signal doesn't exist
  eventId: Option[String] = None,
  retryDuration: Duration = 1000.millis,
)
```

### ExecuteScriptOptions

```scala
final case class ExecuteScriptOptions(
  autoRemove: Boolean = true,         // remove script after execution
  attributes: Seq[(String, String)] = Seq.empty,
  eventId: Option[String] = None,
  retryDuration: Duration = 1000.millis,
)
```

### DispatchEventOptions

```scala
final case class DispatchEventOptions(
  source: Option[CssSelector] = None, // dispatch from specific element
  bubbles: Boolean = true,
  cancelable: Boolean = false,
  composed: Boolean = false,
  autoRemove: Boolean = true,
  eventId: Option[String] = None,
  retryDuration: Duration = 1000.millis,
)
```

---

## Signals (Typed Reactive State)

### Signal Declaration

```scala
Signal[A: Schema](name: String): Signal[A]
Signal[A: Schema](name: SignalName): Signal[A]
Signal[A: Schema](path: String, more: String*): Signal[A]
```

**Examples:**

```scala
val $count = Signal[Int]("count")
val $query = Signal[String]("query")
val $user = Signal[User]("user")  // requires implicit Schema[User]
```

### Signal Properties

```scala
signal.ref: String              // e.g., "$count" for JS expressions
signal.name: SignalName         // the signal name
signal.nest(newPath): Signal[A] // nested signal
```

### Signal Updates

```scala
signal := value  // produces SignalUpdate[A]
```

**Example:**

```scala
val $count = Signal[Int]("count")
$count := 42  // SignalUpdate[Int]
```

---

## HTML Attributes (Datastar Directives)

### Signal Binding

| Attribute | Effect |
|-----------|--------|
| `dataSignals($s) := expr` | Declare signal with initial value; `expr` is a JS expression |
| `dataBind($s.name)` | Two-way bind input/textarea/select to signal |
| `dataText := signal` | Display signal value as element text |
| `dataClass(name) := signal` | Toggle CSS class based on signal |
| `dataStyle(name) := signal` | Set inline style from signal |
| `dataAttr(name) := signal` | Set HTML attribute from signal |

### Event Handling

```scala
dataOn.click := js"@post('/endpoint')"
dataOn.submit := js"@get('/endpoint')"
dataOn.input := js"@put('/endpoint')"
dataOn.keydown := js"evt.code === 'Enter' && @post('/save')"
```

**Available event names:**
`click`, `submit`, `input`, `change`, `keydown`, `keyup`, `focus`, `blur`, `load`, `load`, `mouseover`, `mouseout`, `mouseenter`, `mouseleave`, and more.

### Event Modifiers (chainable)

```scala
dataOn.input.debounce(300.millis) := js"@get('/search')"
dataOn.input.throttle(500.millis) := js"@put('/update')"
dataOn.submit.prevent := js"@post('/form')"              // preventDefault()
dataOn.click.stop := js"@get('/action')"                 // stopPropagation()
dataOn.keydown.once := js"@post('/first-key-only')"      // fire once
dataOn.input.capture := js"..."                           // capture phase
dataOn.click.window := js"..."                            // listen on window object
```

### Other Attributes

```scala
dataInit := request                    // fire request on page load
dataShow := js"expr"                   // conditional visibility
dataIgnore                             // exclude from Datastar
dataIndicator($loadingSignal)          // track request loading state
dataComputed := js"expr"               // computed signal
dataEffect := js"expr"                 // run effect on signal change
dataOnIntersect := js"@post('/endpoint')"  // fire on viewport intersection
dataOnInterval(5.seconds) := js"..."   // fire every N seconds
```

---

## Reading Signals from Requests

### req.readSignals[T]

```scala
def readSignals[T: Schema](request: Request): IO[String, T]
```

Returns the current signal state as a typed case class.

**GET request:**
Signals sent as query parameter: `?datastar={"count":5,"query":"test"}`

**POST request:**
Signals sent in request body as JSON.

**Example:**

```scala
case class FormData(name: String, email: String)
object FormData {
  implicit val schema = DeriveSchema.gen[FormData]
}

handler { (req: Request) =>
  req.readSignals[FormData].flatMap { form =>
    // use form.name, form.email
  }
}
```

---

## DatastarRequest (Endpoint DSL)

Generate Datastar request strings from typed Endpoints.

```scala
Endpoint(Method.GET / "search").out[String].datastarRequest(())
// renders as: @get('/search')

Endpoint(Method.POST / "form" / "submit").out[String].datastarRequest(())
// renders as: @post('/form/submit')
```

**With path parameters:**

```scala
val endpoint = Endpoint(Method.GET / "user" / int("id"))
endpoint.out[String].datastarRequest(ValueOrSignal.Value(123))
// renders as: @get('/user/123')

val $userId = Signal[Int]("userId")
endpoint.out[String].datastarRequest(ValueOrSignal.SignalValue($userId))
// renders as: @get('/user/{$userId}')
```

---

## Page Utilities

### datastarScript

Include Datastar JavaScript library in HTML head:

```scala
head(
  datastarScript,  // CDN version 1.0.1
  // or
  datastarScript("1.0.0"),  // specific version
)
```

Renders as:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@data-star/core@1.0.1/dist/index.js"></script>
```

### mainPage Helper

Generate a complete HTML page scaffold:

```scala
val page = mainPage(
  headContent = seq(
    meta(charset("UTF-8")),
    style.inlineResource("styles.css"),
  ),
  bodyContent = div(/* ... */),
  datastarVersion = "1.0.1",
)
```

---

## CaseModifier (Signal Name Rendering)

Control how signal names are formatted in JavaScript:

```scala
Signal[Int]("userName").caseModifier(CaseModifier.Snake)  // $user_name
Signal[Int]("userName").caseModifier(CaseModifier.Kebab)  // $user-name
Signal[Int]("userName").caseModifier(CaseModifier.Camel)  // $userName (default)
```

---

## Common Patterns

### Conditional Request Based on Event

```scala
button(
  dataOn.click := js"${$count} > 0 && @post('/action')",
  "Do it",
)
```

### Disable Button While Loading

```scala
val $loading = Signal[Boolean]("loading")
button(
  dataAttr("disabled") := js"${$loading}",
  dataIndicator($loading),
  dataOn.click := js"@post('/save')",
  "Save",
)
```

### Enter Key to Submit

```scala
input(
  `type` := "text",
  dataBind($message.name),
  dataOn.keydown := js"evt.code === 'Enter' && @post('/send')",
)
```

### Live Search with Debounce

```scala
val $query = Signal[String]("query")
input(
  `type` := "search",
  placeholder := "Search...",
  dataSignals($query) := "",
  dataBind($query.name),
  dataOn.input.debounce(300.millis) := js"@get('/search?q=' + ${$query})",
)
```

### Periodic Updates

```scala
div(
  dataText := $currentTime,
  dataOnInterval(1.second) := js"@get('/time')",
)
```

---

## Schema Derivation (Scala 2 vs Scala 3)

**Scala 2:**
```scala
case class MyData(name: String, count: Int)
object MyData {
  implicit val schema = DeriveSchema.gen[MyData]
}
```

**Scala 3:**
```scala
case class MyData(name: String, count: Int) derives Schema
```

Both produce the same `Schema[MyData]` for use with `readSignals[T]`.

---

## References

- [Datastar Docs](https://data-star.dev)
- [ZIO Schema](https://zio.dev/zio-schema)
- [ZIO HTTP](https://zio.dev/zio-http)
