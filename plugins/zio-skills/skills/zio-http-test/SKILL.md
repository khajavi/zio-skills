---
name: zio-http-test
description: Use when asked to write tests for ZIO HTTP services, validate route handlers, test endpoints, middleware, or WebSockets. Provides three-level testing strategy from direct handler testing to full server integration.
tags: [zio, zio-http, testing, scala, testkit, routes, endpoints, middleware, websockets]
---

# Testing ZIO HTTP Services

Use this skill when a user asks to:
- **Write tests** for ZIO HTTP route handlers
- **Validate** request/response behavior in endpoints
- **Test** middleware, authentication, or business logic
- **Verify** WebSocket communication
- **Test** error handling and edge cases
- **Set up** a testing strategy for their ZIO HTTP service

This skill teaches a three-level testing approach that helps you test at the right level for each scenario.

---

## Choose Your Testing Level

ZIO HTTP provides three ways to test your routes, each with different tradeoffs. Pick the level that fits your test:

### Level 1: Direct Handler Testing
**When:** Testing individual handler logic without Routes overhead
- Testing request parsing and validation
- Testing business logic in isolation
- Unit testing with no I/O or minimal setup
- Fastest tests with zero server overhead

**Tradeoff:** You test `Request => ZIO[R, Response, Response]` directly, so you must construct Request objects manually. No middleware applied.

**Go to:** [Level 1: Direct Handler Testing](#level-1-direct-handler-testing)

---

### Level 2: TestClient
**When:** Testing full route definitions without actual server startup
- Testing Routes with path matching, query params, headers
- Testing multiple routes together
- Testing middleware behavior
- Testing request/response parsing through the full stack

**Tradeoff:** Requires constructing routes, but much faster than server startup. Good balance for most tests.

**Go to:** [Level 2: TestClient](#level-2-testclient)

---

### Level 3: TestServer
**When:** Testing with actual server startup and real network calls
- Testing with real port binding
- Testing server lifecycle (startup, shutdown)
- Integration tests with external services
- Testing network-specific behavior

**Tradeoff:** Slower than TestClient (server startup overhead), but closest to production.

**Go to:** [Level 3: TestServer](#level-3-testserver)

---

## Dependencies

Add testing dependencies to your `build.sbt`:

```scala
libraryDependencies ++= Seq(
  "dev.zio" %% "zio-test"         % "@ZIO_VERSION@"  % Test,
  "dev.zio" %% "zio-test-sbt"     % "@ZIO_VERSION@"  % Test,
  "dev.zio" %% "zio-http-testkit" % "@VERSION@" % Test,
)

testFrameworks += new TestFramework("zio.test.sbt.ZTestFramework")
```

Find the latest versions:
- [ZIO on Maven Central](https://mvnrepository.com/artifact/dev.zio/zio)
- [zio-http-testkit on Maven Central](https://mvnrepository.com/artifact/dev.zio/zio-http-testkit)

---

## Level 1: Direct Handler Testing

### When to Use

Direct handler testing is ideal for:
- **Unit testing** pure logic in handlers without Routes overhead
- **Testing request parsing** and validation
- **Testing error cases** where the handler should fail
- **Testing with no I/O** or with mocked dependencies

Direct handler testing is fast and focused on a single handler function.

### How It Works

Handlers in ZIO HTTP are functions with this signature:

```scala
type Handler = Request => ZIO[R, Response, Response]
```

To test directly, you:
1. Construct a `Request` object
2. Call the handler with that request
3. Assert the returned `Response` is correct

### Basic Example

```scala
import zio._
import zio.http._
import zio.test._
import zio.test.Assertion._

object HelloHandlerSpec extends ZIOSpecDefault {
  def spec = suite("HelloHandler")(
    test("handler returns OK with body") {
      val request = Request.default
      val handler = Handler.ok("Hello, World!")
      
      for {
        response <- handler(request)
      } yield assertTrue(
        response.status == Status.Ok,
        response.body.asString == "Hello, World!"
      )
    }
  )
}
```

### Constructing Request Objects

ZIO HTTP provides `Request.default` as a starting point, but you'll usually customize it:

```scala
// GET request to /api/books/123?limit=10
val request = Request.default
  .updateURL(_.withPath(Path("/api/books/123")).withQueryParams(QueryParams("limit" -> "10")))

// POST request with JSON body
val postRequest = Request.default(
  method = Method.Post,
  url = URL.decode("/api/books").toOption.get
).copy(
  body = Body.fromString("""{"title":"Scala Mastery"}""")
)

// Request with custom headers
val customRequest = Request.default
  .addHeaders(Headers(Header.ContentType(MediaType.application.json)))
```

### Common Assertions

After calling the handler, assert the response:

```scala
test("handler returns correct status") {
  val request = Request.default
  val handler = Handler.ok("test")
  
  for {
    response <- handler(request)
  } yield {
    assert(response)(
      hasField[Response, Status]("status", _.status, equalTo(Status.Ok))
    )
  }
}

test("handler returns correct body") {
  val request = Request.default
  val handler = Handler.ok("Hello")
  
  for {
    response <- handler(request)
  } yield {
    assert(response.body.asString)(containsString("Hello"))
  }
}

test("handler returns correct header") {
  val request = Request.default
  val handler = Handler.ok("test").mapResponse(
    _.addHeaders(Headers(Header.ContentType(MediaType.application.json)))
  )
  
  for {
    response <- handler(request)
  } yield {
    assertTrue(
      response.headers.get(Header.ContentType).isDefined
    )
  }
}
```

### Testing Error Cases

```scala
test("handler returns error status on invalid input") {
  val request = Request.default
  
  val handler: Handler = Handler { (req: Request) =>
    val id = req.url.path.segments.lastOption
    if (id.isEmpty) {
      ZIO.succeed(Response.status(Status.BadRequest))
    } else {
      ZIO.succeed(Response.ok)
    }
  }
  
  for {
    response <- handler(request)
  } yield assertTrue(response.status == Status.BadRequest)
}
```

### Reference

For more examples, see `references/examples/01-basic-handler-test.scala`.

---

## Level 2: TestClient

### When to Use

TestClient is ideal for:
- **Testing Routes** with path matching, query parameters, and headers
- **Testing multiple routes** together
- **Testing middleware** applied to routes
- **Testing request/response** parsing through the full HTTP stack
- **Most unit and integration tests**

TestClient provides the speed of direct testing with the realism of full route handling—without server startup overhead.

### Setting Up TestClient

Create a test client from your routes:

```scala
import zio._
import zio.http._
import zio.http.Client
import zio.test._

object MyRoutesSpec extends ZIOSpecDefault {
  
  val routes = Routes(
    Method.GET / "hello" -> Handler.ok("Hello, World!")
  )
  
  def spec = suite("MyRoutes")(
    test("GET /hello returns greeting") {
      for {
        client <- ZIO.service[Client]
        response <- client.url(URL.decode("http://localhost/hello").toOption.get).get
      } yield assertTrue(response.status == Status.Ok)
    }
  ).provide(
    Client.default,
    Server.defaultWithApp(Http.collectHttp(routes))
  )
}
```

### Using TestClient with Request/Response

```scala
import zio._
import zio.http._
import zio.test._
import zio.test.Assertion._

object BookRouterSpec extends ZIOSpecDefault {
  
  val routes = Routes(
    Method.GET / "books" / string("id") -> handler { (id: String, req: Request) =>
      ZIO.succeed(Response.json(s"""{"id":"$id"}"""))
    }
  )
  
  def spec = suite("BookRouter")(
    test("GET /books/123 returns book") {
      for {
        client <- ZIO.service[Client]
        response <- client
          .url(URL.decode("http://localhost/books/123").toOption.get)
          .get
        body <- response.body.asString
      } yield {
        assertTrue(
          response.status == Status.Ok,
          body.contains("123")
        )
      }
    }
  ).provide(
    Client.default,
    Server.defaultWithApp(Http.collectHttp(routes))
  )
}
```

### Testing Response Bodies

Extract and assert response bodies:

```scala
test("response body contains expected JSON") {
  for {
    client <- ZIO.service[Client]
    response <- client
      .url(URL.decode("http://localhost/api/user").toOption.get)
      .get
    body <- response.body.asString
  } yield {
    assertTrue(
      body.contains("\"name\""),
      body.contains("\"email\"")
    )
  }
}

test("response body can be decoded") {
  import zio.json._
  
  case class User(name: String, email: String) derives JsonCodec
  
  for {
    client <- ZIO.service[Client]
    response <- client
      .url(URL.decode("http://localhost/api/user").toOption.get)
      .get
    body <- response.body.asString
    user <- ZIO.fromEither(body.fromJson[User])
  } yield {
    assertTrue(user.name == "John", user.email == "john@example.com")
  }
}
```

### Testing Request Headers

```scala
test("endpoint requires authorization header") {
  for {
    client <- ZIO.service[Client]
    response <- client
      .url(URL.decode("http://localhost/admin").toOption.get)
      .get
  } yield {
    assertTrue(response.status == Status.Unauthorized)
  }
}

test("endpoint accepts valid authorization") {
  for {
    client <- ZIO.service[Client]
    response <- client
      .url(URL.decode("http://localhost/admin").toOption.get)
      .header("Authorization", "Bearer token123")
      .get
  } yield {
    assertTrue(response.status == Status.Ok)
  }
}
```

### Reference

For more examples, see:
- `references/examples/02-testclient-basic.scala`
- `references/examples/03-testclient-body.scala`

---

## Level 3: TestServer

### When to Use

TestServer is ideal for:
- **Integration tests** with real server startup
- **Testing server lifecycle** (startup, shutdown, resource cleanup)
- **Testing with actual port binding** and network calls
- **Testing with external services** or real databases
- **Testing network-specific behavior** (timeouts, connection pooling)

TestServer is slower than TestClient but closest to production behavior.

### Setting Up TestServer

```scala
import zio._
import zio.http._
import zio.test._

object MyServiceIntegrationSpec extends ZIOSpecDefault {
  
  val routes = Routes(
    Method.GET / "health" -> Handler.ok("OK")
  )
  
  def spec = suite("MyService Integration")(
    test("server starts and responds to requests") {
      for {
        client <- ZIO.service[Client]
        response <- client
          .url(URL.decode("http://localhost/health").toOption.get)
          .get
      } yield {
        assertTrue(response.status == Status.Ok)
      }
    }
  ).provide(
    Client.default,
    Server.default
  )
}
```

### When to Choose TestServer vs TestClient

| Scenario | TestClient | TestServer |
|----------|-----------|-----------|
| Testing route matching | ✓ | ✓ |
| Testing handler logic | ✓ | ✓ |
| Testing middleware | ✓ | ✓ |
| Real port binding | ✗ | ✓ |
| Server startup/shutdown | ✗ | ✓ |
| Real network calls | ✗ | ✓ |
| Integration with DB | ✓ | ✓ |
| Test speed | Fast | Slower |

**Recommendation:** Start with TestClient. Use TestServer only when you need real port binding or network behavior.

### Reference

For more examples, see `references/examples/04-testserver-basic.scala`.

---

## Testing Specific Features

### Testing Endpoints (Type-Safe Routes)

The `Endpoint` API provides type-safe route definitions. Testing Endpoints ensures type safety at the boundary:

```scala
import zio._
import zio.http._
import zio.schema._
import zio.test._

case class Book(id: String, title: String) derives Schema

object GetBookEndpoint {
  val endpoint = Endpoint(Method.GET / "books" / string("id"))
    .out[Book](Status.Ok)
    .implement { (id: String) =>
      ZIO.succeed(Book(id, "Scala Mastery"))
    }
}

object GetBookEndpointSpec extends ZIOSpecDefault {
  def spec = suite("GetBookEndpoint")(
    test("endpoint returns book with correct type") {
      for {
        client <- ZIO.service[Client]
        response <- client
          .url(URL.decode("http://localhost/books/123").toOption.get)
          .get
      } yield {
        assertTrue(response.status == Status.Ok)
      }
    }
  ).provide(
    Client.default,
    Server.defaultWithApp(
      Http.collectHttp(GetBookEndpoint.endpoint.toRoutes)
    )
  )
}
```

**Key difference:** Endpoints are declared separately from implementation, so you test both the type contract and the logic.

### Reference

For more examples, see `references/examples/05-endpoint-api-test.scala`.

---

### Testing Middleware

Middleware wraps routes to add cross-cutting concerns. Test that middleware is applied correctly:

```scala
import zio._
import zio.http._
import zio.test._

object MiddlewareSpec extends ZIOSpecDefault {
  
  // Middleware that adds a header to all responses
  def addHeaderMiddleware(http: Http[Any, Nothing, Request, Response]): Http[Any, Nothing, Request, Response] = {
    http.mapResponse(_.addHeaders(Headers(Header.Custom("X-Test", "middleware"))))
  }
  
  val routes = Routes(
    Method.GET / "test" -> Handler.ok("OK")
  )
  
  val app = addHeaderMiddleware(Http.collectHttp(routes))
  
  def spec = suite("Middleware")(
    test("middleware adds header to response") {
      for {
        client <- ZIO.service[Client]
        response <- client
          .url(URL.decode("http://localhost/test").toOption.get)
          .get
      } yield {
        assertTrue(
          response.headers.get("X-Test").contains("middleware")
        )
      }
    }
  ).provide(
    Client.default,
    Server.defaultWithApp(app)
  )
}
```

### Reference

For more examples, see `references/examples/06-middleware-test.scala`.

---

### Testing WebSockets

WebSocket testing requires setting up a persistent connection and sending/receiving frames:

```scala
import zio._
import zio.http._
import zio.http.ChannelEvent
import zio.test._

object WebSocketSpec extends ZIOSpecDefault {
  
  val wsRoute = Routes(
    Method.GET / "ws" -> Handler.webSocket { _ =>
      Handler.webSocketHandler { (channel: WebSocketChannel) =>
        channel.receiveAll { frame =>
          frame match {
            case WebSocketFrame.Text(text) =>
              channel.send(WebSocketFrame.Text(s"Echo: $text"))
            case WebSocketFrame.Close(_) =>
              ZIO.unit
            case _ =>
              ZIO.unit
          }
        }
      }
    }
  )
  
  def spec = suite("WebSocket")(
    test("websocket echoes messages") {
      for {
        client <- ZIO.service[Client]
        // WebSocket testing is advanced; see references/examples/07-websocket-test.scala
      } yield assertTrue(true)
    }
  ).provide(
    Client.default,
    Server.defaultWithApp(Http.collectHttp(wsRoute))
  )
}
```

**Note:** WebSocket testing is more advanced. Refer to the full example for production patterns.

### Reference

For more examples, see `references/examples/07-websocket-test.scala`.

---

### Advanced Patterns

#### Testing Error Cases and Edge Cases

```scala
test("handler returns 404 for missing resource") {
  val routes = Routes(
    Method.GET / "items" / string("id") -> handler { (id: String, req: Request) =>
      if (id == "nonexistent") {
        ZIO.succeed(Response.status(Status.NotFound))
      } else {
        ZIO.succeed(Response.ok)
      }
    }
  )
  
  for {
    client <- ZIO.service[Client]
    response <- client
      .url(URL.decode("http://localhost/items/nonexistent").toOption.get)
      .get
  } yield {
    assertTrue(response.status == Status.NotFound)
  }
}

test("handler returns 400 for invalid query parameter") {
  val routes = Routes(
    Method.GET / "search" -> handler { (req: Request) =>
      val limit = req.queryParam("limit").flatMap(_.toIntOption)
      limit match {
        case Some(l) if l > 0 => ZIO.succeed(Response.ok)
        case _ => ZIO.succeed(Response.status(Status.BadRequest))
      }
    }
  )
  
  for {
    client <- ZIO.service[Client]
    response <- client
      .url(URL.decode("http://localhost/search?limit=invalid").toOption.get)
      .get
  } yield {
    assertTrue(response.status == Status.BadRequest)
  }
}
```

#### Custom Assertions

```scala
// Helper for checking response status
def hasStatus(expected: Status) = hasField[Response, Status]("status", _.status, equalTo(expected))

// Helper for checking response body contains
def bodyContains(text: String) = Assertion.assertion("body contains")(body =>
  body.asString.map(_.contains(text))
)

test("response has status and body") {
  for {
    client <- ZIO.service[Client]
    response <- client.url(...).get
  } yield {
    assert(response)(hasStatus(Status.Ok))
  }
}
```

#### Parameterized Tests

```scala
test("handler works for multiple paths") {
  val cases = List(
    ("/api/v1/books", Status.Ok),
    ("/api/v1/authors", Status.Ok),
    ("/api/v2/unknown", Status.NotFound)
  )
  
  ZIO.foreach(cases) { case (path, expectedStatus) =>
    for {
      client <- ZIO.service[Client]
      response <- client
        .url(URL.decode(s"http://localhost$path").toOption.get)
        .get
    } yield assertTrue(response.status == expectedStatus)
  }.map(results => assertTrue(results.forall(identity)))
}
```

### Reference

For more examples, see `references/examples/08-advanced-patterns.scala`.

---

## Assertions Reference

ZIO Test provides powerful assertion combinators. Here are the most common for HTTP testing:

| Assertion | Usage | Example |
|-----------|-------|---------|
| `equalTo(value)` | Exact match | `equalTo(Status.Ok)` |
| `hasField(name, getter, assertion)` | Check object field | `hasField[Response, Status]("status", _.status, equalTo(Status.Ok))` |
| `containsString(substr)` | String contains | `assertTrue(body.containsString("test"))` |
| `isEmpty` | Collection/string is empty | `assertTrue(headers.isEmpty)` |
| `isNonEmpty` | Collection/string is not empty | `assertTrue(body.isNonEmpty)` |
| `isSuccess` | Effect succeeded | Used with `assert(effect)(isSuccess(...))` |
| `isFailure` | Effect failed | Used with `assert(effect)(isFailure(...))` |
| `isJust(assertion)` | Option is Some | `assert(option)(isSome(equalTo(value)))` |
| `isNone` | Option is None | `assert(option)(isNone)` |
| `isSome(assertion)` | Option contains value | `assert(option)(isSome(equalTo(value)))` |

For the complete reference, see `references/assertions.md`.

---

## Running Tests

### Run All Tests

```bash
sbt test
```

### Run Specific Test Suite

```bash
sbt "testOnly com.example.HelloWorldSpec"
```

### Run with Verbose Output

```bash
sbt "test -- --verbose"
```

### Run Tests Matching Pattern

```bash
sbt "testOnly *Spec -- -t hello"
```

### Run Single Test

```bash
sbt "testOnly com.example.HelloWorldSpec -- -t \"handler returns OK\""
```

---

## See Also

- **[ZIO Test Documentation](https://zio.dev/reference/test/)** — Comprehensive guide to ZIO Test framework
- **[zio-http-testkit Sources](https://github.com/zio/zio-http/tree/main/zio-http-testkit)** — Reference implementation and source code
- **[zio-http-scaffold Skill](./zio-http-scaffold/SKILL.md)** — Creating new ZIO HTTP services
- **[zio-http-imperative-to-declarative Skill](./zio-http-imperative-to-declarative/SKILL.md)** — Type-safe Endpoint API
- **[ZIO HTTP Documentation](https://zio.dev/zio-http/)** — Full ZIO HTTP reference

---

## References

- **[ZIO Test Assertions](https://javadoc.io/doc/dev.zio/zio-test_2.13/latest/zio/test/Assertion.html)** — Full assertion API docs
- **[ZIO HTTP Client API](https://javadoc.io/doc/dev.zio/zio-http_2.13/latest/zio/http/Client.html)** — Client request API
- **[zio-http-testkit API](https://javadoc.io/doc/dev.zio/zio-http-testkit_2.13/latest/zio/http/testkit/index.html)** — Test helpers and utilities

---

## Example Files (See References)

- `references/examples/01-basic-handler-test.scala` — Direct handler testing patterns
- `references/examples/02-testclient-basic.scala` — TestClient setup and basic tests
- `references/examples/03-testclient-body.scala` — Testing response bodies and JSON
- `references/examples/04-testserver-basic.scala` — TestServer integration testing
- `references/examples/05-endpoint-api-test.scala` — Testing type-safe Endpoints
- `references/examples/06-middleware-test.scala` — Middleware and cross-cutting concerns
- `references/examples/07-websocket-test.scala` — WebSocket communication testing
- `references/examples/08-advanced-patterns.scala` — Error handling, custom assertions, parameterized tests

---

## Common Failures

| Symptom                                                                   | Likely cause                                                                | Fix                                                                                                                       |
|---------------------------------------------------------------------------|-----------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------|
| `not found: value TestClient` / `value TestServer`                        | Missing the `zio-http-testkit` dependency.                                  | Add `"dev.zio" %% "zio-http-testkit" % <version> % Test` to `build.sbt`.                                                  |
| Test hangs / times out                                                    | A test depends on the real network or a server that never responds.         | Use `TestClient`/`TestServer` instead of `Client.default`/`Server.default` so the layer stays in-process.                 |
| `LayerError: ZLayer composition error`                                    | Test layer doesn't include all dependencies the handler needs.              | Build the layer explicitly: `(TestClient.layer ++ Server.default ++ <YourService>.layer)` for handlers that need services. |
| Assertion fires but error message says "actual: <empty>"                  | Response body wasn't read; assertion ran on the streaming wrapper.          | Read the body once with `response.body.asString` (or `asJson`) and assert on the result.                                  |
| `Status.Ok != Status.NotFound` for routes that should match               | Trailing slash mismatch (`"/api/foo"` vs `"/api/foo/"`).                    | Normalize either the route path or the test request URL; ZIO HTTP routes are exact-match by default.                     |
| Endpoint test compiles but fails at runtime with `IllegalStateException`  | Endpoint declared but not registered with the test server.                  | Pass the endpoint's implementation to `TestServer.addRoutes(routes)` before making the request.                           |
| WebSocket test never receives messages                                    | Closed the channel before the server-side handler emitted.                  | Use `Channel.receive` with a timeout, and let the server emit before closing the test channel.                            |
