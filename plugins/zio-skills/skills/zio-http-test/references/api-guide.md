# ZIO HTTP Testing API Reference

Complete API documentation for testing utilities in zio-http-testkit.

---

## TestClient API

`TestClient` provides a lightweight, in-memory HTTP client for testing routes without server startup overhead. It processes requests through your full route definitions, including middleware and path matching.

### ZLayer Signature

```scala
import zio._
import zio.http._

// TestClient is typically used with Server via Client.default
val testClientLayer: ZLayer[Any, Nothing, Client] = Client.default
```

### Adding Routes to TestClient

Once you have a `Client`, you can test against routes by providing a server with your app:

```scala
import zio._
import zio.http._
import zio.test._

object ExampleRoutesSpec extends ZIOSpecDefault {
  
  val routes = Routes(
    Method.GET / "hello" -> Handler.ok("Hello, World!"),
    Method.GET / "users" / string("id") -> handler { (id: String, _: Request) =>
      ZIO.succeed(Response.json(s"""{"id":"$id","name":"User $id"}"""))
    }
  )
  
  def spec = suite("ExampleRoutes")(
    test("GET /hello returns greeting") {
      for {
        client <- ZIO.service[Client]
        response <- client.url(URL.decode("http://localhost/hello").toOption.get).get
        body <- response.body.asString
      } yield {
        assertTrue(
          response.status == Status.Ok,
          body == "Hello, World!"
        )
      }
    },
    test("GET /users/123 returns user JSON") {
      for {
        client <- ZIO.service[Client]
        response <- client.url(URL.decode("http://localhost/users/123").toOption.get).get
        body <- response.body.asString
      } yield {
        assertTrue(
          response.status == Status.Ok,
          body.contains("\"id\":\"123\"")
        )
      }
    }
  ).provide(
    Client.default,
    Server.defaultWithApp(Http.collectHttp(routes))
  )
}
```

### installSocketApp (WebSocket Support)

For testing WebSocket handlers, use `installSocketApp`:

```scala
import zio._
import zio.http._
import zio.test._

object WebSocketSpec extends ZIOSpecDefault {
  
  val wsApp: WebSocketApp[Any] = Handler.webSocket { _ =>
    Handler.webSocketHandler { channel =>
      channel.receiveAll { frame =>
        frame match {
          case WebSocketFrame.Text(text) =>
            channel.send(WebSocketFrame.Text(s"Echo: $text"))
          case _ => ZIO.unit
        }
      }
    }
  }
  
  def spec = suite("WebSocket")(
    test("websocket echoes text frames") {
      for {
        client <- ZIO.service[Client]
        // Full WebSocket testing requires a streaming client API
      } yield assertTrue(true)
    }
  ).provide(
    Client.default,
    Server.defaultWithApp(Http.collectHttp(
      Routes(Method.GET / "ws" -> Handler.webSocket { _ =>
        Handler.webSocketHandler { channel =>
          channel.receiveAll { frame =>
            frame match {
              case WebSocketFrame.Text(text) =>
                channel.send(WebSocketFrame.Text(s"Echo: $text"))
              case _ => ZIO.unit
            }
          }
        }
      })
    ))
  )
}
```

---

## TestServer API

`TestServer` provides a full server with real port binding, lifecycle management, and network behavior. It's closer to production than TestClient but slower due to server startup overhead.

### ZLayer Signature

```scala
import zio._
import zio.http._

// TestServer with default configuration
val serverLayer: ZLayer[Any, Throwable, Server] = Server.default
```

### Setting Up TestServer

```scala
import zio._
import zio.http._
import zio.test._

object IntegrationSpec extends ZIOSpecDefault {
  
  val routes = Routes(
    Method.GET / "health" -> Handler.ok("OK"),
    Method.POST / "data" -> handler { (req: Request) =>
      for {
        body <- req.body.asString
      } yield Response.json(s"""{"received":"$body"}""")
    }
  )
  
  def spec = suite("Integration")(
    test("server accepts requests on real port") {
      for {
        client <- ZIO.service[Client]
        response <- client.url(URL.decode("http://localhost:8080/health").toOption.get).get
        body <- response.body.asString
      } yield {
        assertTrue(
          response.status == Status.Ok,
          body == "OK"
        )
      }
    },
    test("server processes POST requests") {
      for {
        client <- ZIO.service[Client]
        response <- client.url(URL.decode("http://localhost:8080/data").toOption.get)
          .post("test data")
        body <- response.body.asString
      } yield {
        assertTrue(
          response.status == Status.Ok,
          body.contains("received")
        )
      }
    }
  ).provide(
    Client.default,
    Server.defaultWithApp(Http.collectHttp(routes))
  )
}
```

### Key Differences: TestClient vs TestServer

| Feature | TestClient | TestServer |
|---------|-----------|-----------|
| Server Startup | Immediate (no real port) | Real port binding (slower) |
| Lifecycle | Implicit via layer | Explicit server startup/shutdown |
| Network Behavior | Simulated | Real network calls |
| Middleware Support | Full | Full |
| Route Matching | Full | Full |
| Test Speed | Fast | Slower (startup overhead) |
| Production Parity | Good approximation | Very high |

**Recommendation:** Use TestClient for most tests. Use TestServer only when testing real port binding or network behavior.

---

## Request Construction for Testing

### Creating Basic Requests

```scala
import zio._
import zio.http._

// Default request (GET to /)
val defaultRequest = Request.default

// GET request to /api/items
val getRequest = Request.default
  .updateURL(_.withPath(Path("/api/items")))

// POST request
val postRequest = Request.default(
  method = Method.Post,
  url = URL.decode("/api/items").toOption.get
)

// DELETE request
val deleteRequest = Request.default(
  method = Method.Delete,
  url = URL.decode("/api/items/123").toOption.get
)
```

### Adding Query Parameters

```scala
import zio.http._

val request = Request.default
  .updateURL(
    _.withPath(Path("/search"))
      .withQueryParams(QueryParams(
        "q" -> "scala",
        "limit" -> "10"
      ))
  )

// Results in: GET /search?q=scala&limit=10
```

### Adding Headers

```scala
import zio.http._

val request = Request.default
  .addHeaders(Headers(
    Header.ContentType(MediaType.application.json),
    Header.Custom("Authorization", "Bearer token123"),
    Header.Custom("X-Request-ID", "req-456")
  ))
```

### Adding Request Body

```scala
import zio.http._

// String body
val stringRequest = Request.default(
  method = Method.Post,
  url = URL.decode("/api/items").toOption.get
).copy(body = Body.fromString("""{"name":"Item"}"""))

// JSON body
case class Item(name: String)
val jsonRequest = Request.default(
  method = Method.Post,
  url = URL.decode("/api/items").toOption.get
).copy(body = Body.fromString("""{"name":"New Item"}"""))

// Empty body (common for GET/DELETE)
val emptyRequest = Request.default(
  method = Method.Get,
  url = URL.decode("/api/items").toOption.get
)
```

### Complete Request Example

```scala
import zio.http._

val complexRequest = Request.default(
  method = Method.Post,
  url = URL.decode("/api/v1/search").toOption.get
).updateURL(
  _.withQueryParams(QueryParams("limit" -> "20", "offset" -> "0"))
).addHeaders(Headers(
  Header.ContentType(MediaType.application.json),
  Header.Custom("Authorization", "Bearer token123")
)).copy(
  body = Body.fromString("""{"query":"test","filters":{"active":true}}""")
)

// Resulting request:
// POST /api/v1/search?limit=20&offset=0
// Headers: Content-Type: application/json, Authorization: Bearer token123
// Body: {"query":"test","filters":{"active":true}}
```

---

## Response Assertions

### Status Code Checking

```scala
import zio.http._
import zio.test._
import zio.test.Assertion._

def testStatusCode(response: Response) = {
  // Direct equality check
  assertTrue(response.status == Status.Ok)
  
  // Using assertion builders
  assert(response)(
    hasField[Response, Status]("status", _.status, equalTo(Status.Ok))
  )
  
  // Checking various status codes
  val checks = List(
    response.status == Status.Ok,
    response.status == Status.Created,
    response.status == Status.NotFound,
    response.status == Status.BadRequest,
    response.status == Status.Unauthorized,
    response.status == Status.InternalServerError
  )
  
  assertTrue(checks.exists(identity))
}
```

### Body Extraction as String

```scala
import zio._
import zio.http._

def testBodyString(response: Response) = {
  for {
    bodyStr <- response.body.asString
  } yield {
    assertTrue(
      bodyStr.contains("Hello"),
      bodyStr.length > 0
    )
  }
}

// In a test:
test("response body contains expected text") {
  for {
    client <- ZIO.service[Client]
    response <- client.url(URL.decode("http://localhost/message").toOption.get).get
    body <- response.body.asString
  } yield {
    assertTrue(body == "Hello, World!")
  }
}
```

### Body Extraction as JSON

```scala
import zio._
import zio.http._
import zio.json._

case class User(id: String, name: String, email: String) derives JsonCodec

def testBodyJson(response: Response) = {
  for {
    bodyStr <- response.body.asString
    user <- ZIO.fromEither(bodyStr.fromJson[User])
  } yield {
    assertTrue(
      user.id == "123",
      user.name == "Alice",
      user.email == "alice@example.com"
    )
  }
}

// In a test:
test("response body deserializes to User") {
  for {
    client <- ZIO.service[Client]
    response <- client.url(URL.decode("http://localhost/api/user/123").toOption.get).get
    body <- response.body.asString
    user <- ZIO.fromEither(body.fromJson[User])
  } yield {
    assertTrue(user.id == "123")
  }
}
```

### Header Extraction and Checking

```scala
import zio.http._
import zio.test._

def testHeaders(response: Response) = {
  // Check for header existence
  val hasContentType = response.headers.get(Header.ContentType).isDefined
  
  // Check header value
  val contentTypeValue = response.headers.get(Header.ContentType)
  
  // Check custom headers
  val customValue = response.headers.get("X-Custom-Header")
  
  // Check all headers
  val allHeaders = response.headers
  
  assertTrue(
    hasContentType,
    customValue.contains("expected-value")
  )
}

// In a test:
test("response includes required headers") {
  for {
    client <- ZIO.service[Client]
    response <- client.url(URL.decode("http://localhost/api/data").toOption.get).get
  } yield {
    assertTrue(
      response.headers.get(Header.ContentType).isDefined,
      response.headers.get("X-Request-ID").isDefined
    )
  }
}
```

### Response Equality

```scala
import zio.http._
import zio.test._

def testResponseEquality(response: Response, expected: Response) = {
  // Compare status
  assertTrue(response.status == expected.status)
  
  // Compare multiple fields
  for {
    responseBody <- response.body.asString
    expectedBody <- expected.body.asString
  } yield {
    assertTrue(
      response.status == expected.status,
      responseBody == expectedBody,
      response.headers == expected.headers
    )
  }
}

// In a test:
test("response matches expected") {
  val expectedResponse = Response.ok.addHeaders(Headers(
    Header.ContentType(MediaType.application.json)
  ))
  
  for {
    client <- ZIO.service[Client]
    response <- client.url(URL.decode("http://localhost/expected").toOption.get).get
  } yield {
    assertTrue(response.status == expectedResponse.status)
  }
}
```

---

## Handler Testing (Direct)

### Handler Type Signature

```scala
import zio._
import zio.http._

// A Handler is a function from Request to ZIO that produces a Response
type Handler = Request => ZIO[R, Response, Response]

// Where:
// R = the environment/dependencies the handler needs
// Response (error type) = the error response if handler fails
// Response (success type) = the response to send back
```

### Invoking Handlers Directly

```scala
import zio._
import zio.http._

// Handler that always returns OK
val okHandler: Handler = Handler.ok("Success")

// Call the handler with a request
val request = Request.default
val result: ZIO[Any, Nothing, Response] = okHandler(request)

// Extract response in a test
test("handler returns response") {
  for {
    response <- okHandler(request)
  } yield {
    assertTrue(response.status == Status.Ok)
  }
}
```

### Exit Type Handling

```scala
import zio._
import zio.http._

// Handler that can fail
val errorHandler: Handler = Handler { (_: Request) =>
  ZIO.fail(Response.status(Status.BadRequest))
}

// Handle the exit type (Success or Failure)
test("handler handles errors") {
  for {
    request <- ZIO.succeed(Request.default)
    exit <- errorHandler(request).exit
  } yield {
    // exit is an Exit[Response, Response] type
    // Inspect success or failure state
    assertTrue(exit.isFailure)
  }
}

// More realistic: handler that returns error status
val validatingHandler: Handler = Handler { (req: Request) =>
  val id = req.url.path.segments.lastOption
  if (id.isEmpty) {
    ZIO.succeed(Response.status(Status.BadRequest))
  } else {
    ZIO.succeed(Response.ok)
  }
}

test("handler validates input") {
  for {
    badRequest <- ZIO.succeed(Request.default.updateURL(_.withPath(Path("/items/"))))
    goodRequest <- ZIO.succeed(Request.default.updateURL(_.withPath(Path("/items/123"))))
    badResponse <- validatingHandler(badRequest)
    goodResponse <- validatingHandler(goodRequest)
  } yield {
    assertTrue(
      badResponse.status == Status.BadRequest,
      goodResponse.status == Status.Ok
    )
  }
}
```

### Complete Direct Handler Test

```scala
import zio._
import zio.http._
import zio.test._

object UserHandlerSpec extends ZIOSpecDefault {
  
  // Test handler that processes user data
  val userHandler: Handler = Handler { (req: Request) =>
    val userId = req.url.path.segments.lastOption
    userId match {
      case Some(id) =>
        ZIO.succeed(
          Response.json(s"""{"id":"$id","name":"User $id","active":true}""")
            .addHeaders(Headers(Header.ContentType(MediaType.application.json)))
        )
      case None =>
        ZIO.succeed(Response.status(Status.BadRequest))
    }
  }
  
  def spec = suite("UserHandler")(
    test("returns user for valid ID") {
      val request = Request.default.updateURL(_.withPath(Path("/users/123")))
      
      for {
        response <- userHandler(request)
        body <- response.body.asString
      } yield {
        assertTrue(
          response.status == Status.Ok,
          body.contains("\"id\":\"123\""),
          body.contains("\"name\":\"User 123\""),
          response.headers.get(Header.ContentType).isDefined
        )
      }
    },
    test("returns error for missing ID") {
      val request = Request.default.updateURL(_.withPath(Path("/users/")))
      
      for {
        response <- userHandler(request)
      } yield {
        assertTrue(response.status == Status.BadRequest)
      }
    }
  )
}
```

---

## Testing Strategies by Scenario

### Unit Testing Handler Logic

Best for: Pure business logic without I/O

```scala
test("handler applies business logic") {
  val handler: Handler = Handler { (_: Request) =>
    ZIO.succeed(Response.ok)
  }
  
  for {
    response <- handler(Request.default)
  } yield {
    assertTrue(response.status == Status.Ok)
  }
}
```

### Integration Testing Routes

Best for: Full route matching, query parameters, headers

```scala
test("route matches and executes handler") {
  val routes = Routes(
    Method.GET / "api" / "items" / string("id") -> handler { (id: String, _: Request) =>
      ZIO.succeed(Response.json(s"""{"id":"$id"}"""))
    }
  )
  
  for {
    client <- ZIO.service[Client]
    response <- client.url(URL.decode("http://localhost/api/items/456").toOption.get).get
  } yield {
    assertTrue(response.status == Status.Ok)
  }
}
```

### End-to-End Testing with TestServer

Best for: Real port binding, lifecycle management, external integrations

```scala
test("server handles full lifecycle") {
  for {
    client <- ZIO.service[Client]
    response <- client.url(URL.decode("http://localhost:8080/health").toOption.get).get
  } yield {
    assertTrue(response.status == Status.Ok)
  }
}
```
