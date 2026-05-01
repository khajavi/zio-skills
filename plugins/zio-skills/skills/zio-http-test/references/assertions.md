# ZIO Test Assertions for HTTP Testing

Common assertions used when testing HTTP handlers, routes, and clients. This guide covers assertions from ZIO Test that are most useful for HTTP testing scenarios.

---

## Basic Assertions

### assertTrue / assertFalse

Check simple boolean conditions.

**When to use:** Validating true/false conditions, especially for status checks or presence of values.

```scala
import zio._
import zio.http._
import zio.test._

test("response status is OK") {
  for {
    client <- ZIO.service[Client]
    response <- client.url(URL.decode("http://localhost/api/test").toOption.get).get
  } yield {
    // Assert that status equals OK
    assertTrue(response.status == Status.Ok)
  }
}

test("response body is not empty") {
  for {
    client <- ZIO.service[Client]
    response <- client.url(URL.decode("http://localhost/api/data").toOption.get).get
    body <- response.body.asString
  } yield {
    // Assert that body has content
    assertTrue(body.nonEmpty)
    // Or using assertFalse
    assertFalse(body.isEmpty)
  }
}
```

### assertEquals

Check exact equality between two values.

**When to use:** Comparing response status, body content, or field values.

```scala
import zio._
import zio.http._
import zio.test._

test("response has exact status") {
  for {
    client <- ZIO.service[Client]
    response <- client.url(URL.decode("http://localhost/api/greeting").toOption.get).get
    body <- response.body.asString
  } yield {
    // Assert exact values
    assertTrue(
      response.status == Status.Ok,
      body == "Hello, World!"
    )
  }
}

test("handler returns exact response") {
  val handler = Handler.ok("Expected Output")
  
  for {
    response <- handler(Request.default)
    body <- response.body.asString
  } yield {
    // Direct equality assertion
    assertTrue(body == "Expected Output")
  }
}
```

### assert with Assertion[T] Builder

Build complex assertions using assertion combinators.

**When to use:** Complex multi-field checks, collection assertions, or when composing multiple conditions.

```scala
import zio._
import zio.http._
import zio.test._
import zio.test.Assertion._

test("response meets multiple criteria") {
  for {
    client <- ZIO.service[Client]
    response <- client.url(URL.decode("http://localhost/api/user").toOption.get).get
    body <- response.body.asString
  } yield {
    // Use assertion builders for complex checks
    assert(response)(
      hasField[Response, Status]("status", _.status, equalTo(Status.Ok))
    ) &&
    assert(body)(
      containsString("name") && containsString("email")
    )
  }
}

test("response headers contain required values") {
  for {
    client <- ZIO.service[Client]
    response <- client.url(URL.decode("http://localhost/api/secure").toOption.get).get
  } yield {
    // Check multiple header conditions
    assert(response.headers.get("Content-Type"))(
      isSome(containsString("json"))
    ) &&
    assert(response.headers.get("X-Request-ID"))(
      isSome(anything)
    )
  }
}

test("collection of responses") {
  val responses = List(
    Response.ok,
    Response.status(Status.Created),
    Response.status(Status.BadRequest)
  )
  
  // Check all responses match a condition
  assert(responses)(
    forall(
      hasField[Response, Status]("status", _.status, isGreaterThanOrEqualTo(Status.Ok))
    )
  )
}
```

---

## HTTP-Specific Assertions

### Status Code Assertions

Check HTTP status codes.

**When to use:** Verifying correct status codes in responses (200 OK, 404 Not Found, etc.).

```scala
import zio._
import zio.http._
import zio.test._
import zio.test.Assertion._

test("success responses have OK status") {
  val successStatuses = List(
    Status.Ok,
    Status.Created,
    Status.Accepted,
    Status.NoContent
  )
  
  for {
    client <- ZIO.service[Client]
    responses <- ZIO.foreach(successStatuses) { status =>
      ZIO.succeed(Response.status(status))
    }
  } yield {
    // All responses should be in success range
    assert(responses)(
      forall(
        hasField[Response, Status]("status", _.status, 
          isGreaterThanOrEqualTo(Status.Ok) && isLessThan(Status.BadRequest)
        )
      )
    )
  }
}

test("error endpoints return appropriate status") {
  for {
    client <- ZIO.service[Client]
    notFoundResponse <- client.url(URL.decode("http://localhost/api/missing").toOption.get).get
    unauthorizedResponse <- client.url(URL.decode("http://localhost/api/admin").toOption.get).get
  } yield {
    // Direct comparison
    assertTrue(
      notFoundResponse.status == Status.NotFound,
      unauthorizedResponse.status == Status.Unauthorized
    )
  }
}

test("status code assertions with assertion builders") {
  for {
    response <- Handler.ok("test")(Request.default)
  } yield {
    // Using assertion builders
    assert(response)(
      hasField[Response, Status]("status", _.status, 
        equalTo(Status.Ok) || equalTo(Status.Created)
      )
    )
  }
}
```

### Header Assertions

Check for headers and their values.

**When to use:** Verifying presence of required headers (Content-Type, Authorization, etc.) or header values.

```scala
import zio._
import zio.http._
import zio.test._
import zio.test.Assertion._

test("response includes required headers") {
  val handler = Handler.ok("data").mapResponse(
    _.addHeaders(Headers(
      Header.ContentType(MediaType.application.json),
      Header.Custom("X-Request-ID", "12345")
    ))
  )
  
  for {
    response <- handler(Request.default)
  } yield {
    // Check header presence
    assertTrue(
      response.headers.get(Header.ContentType).isDefined,
      response.headers.get("X-Request-ID").isDefined
    )
  }
}

test("response headers have correct values") {
  val handler = Handler.ok("test").mapResponse(
    _.addHeaders(Headers(
      Header.ContentType(MediaType.application.json),
      Header.Custom("Cache-Control", "max-age=3600")
    ))
  )
  
  for {
    response <- handler(Request.default)
  } yield {
    // Check header values using assertions
    assert(response.headers.get("Content-Type"))(
      isSome(containsString("application/json"))
    ) &&
    assert(response.headers.get("Cache-Control"))(
      isSome(equalTo("max-age=3600"))
    )
  }
}

test("missing headers are handled correctly") {
  for {
    response <- Handler.ok("test")(Request.default)
  } yield {
    // Assert that optional headers are not present
    assert(response.headers.get("X-Custom"))(
      isNone
    )
  }
}

test("content type header correctness") {
  for {
    jsonHandler <- Handler.ok("{}").mapResponse(
      _.addHeaders(Headers(Header.ContentType(MediaType.application.json)))
    )(Request.default)
    plainHandler <- Handler.ok("text").mapResponse(
      _.addHeaders(Headers(Header.ContentType(MediaType.text.plain)))
    )(Request.default)
  } yield {
    // Verify content types
    assert(jsonHandler.headers.get(Header.ContentType))(
      isSome(anything)
    ) &&
    assert(plainHandler.headers.get(Header.ContentType))(
      isSome(anything)
    )
  }
}
```

### Body Content Assertions

Check response body content.

**When to use:** Verifying response contains expected text, JSON structure, or data.

```scala
import zio._
import zio.http._
import zio.test._
import zio.test.Assertion._

test("response body contains expected text") {
  val handler = Handler.ok("""
    {
      "users": [
        {"id": "1", "name": "Alice"},
        {"id": "2", "name": "Bob"}
      ]
    }
  """)
  
  for {
    response <- handler(Request.default)
    body <- response.body.asString
  } yield {
    // Check for substring presence
    assert(body)(
      containsString("Alice") && containsString("Bob")
    )
  }
}

test("response body matches exact value") {
  val expectedBody = "Success: Operation completed"
  val handler = Handler.ok(expectedBody)
  
  for {
    response <- handler(Request.default)
    body <- response.body.asString
  } yield {
    // Exact match assertion
    assertTrue(body == expectedBody)
  }
}

test("response body has minimum length") {
  val handler = Handler.ok("short response with some content here")
  
  for {
    response <- handler(Request.default)
    body <- response.body.asString
  } yield {
    // Check body properties
    assertTrue(body.length > 10)
  }
}

test("JSON body structure validation") {
  import zio.json._
  
  case class Item(id: String, name: String, active: Boolean) derives JsonCodec
  
  val handler = Handler.ok("""{"id":"123","name":"Test","active":true}""").mapResponse(
    _.addHeaders(Headers(Header.ContentType(MediaType.application.json)))
  )
  
  for {
    response <- handler(Request.default)
    body <- response.body.asString
    item <- ZIO.fromEither(body.fromJson[Item])
  } yield {
    // Validate decoded structure
    assertTrue(
      item.id == "123",
      item.name == "Test",
      item.active == true
    )
  }
}

test("response body can be parsed as JSON") {
  import zio.json._
  
  val jsonBody = """{"status":"ok","code":200}"""
  val handler = Handler.ok(jsonBody)
  
  for {
    response <- handler(Request.default)
    body <- response.body.asString
    parsed <- ZIO.fromEither(body.fromJson[Map[String, Any]])
  } yield {
    // Successfully parsed
    assertTrue(!parsed.isEmpty)
  }
}
```

### Response Type Assertions

Check if handler success/failure results.

**When to use:** Testing handler exit types, error handling, or ZIO effects that might fail.

```scala
import zio._
import zio.http._
import zio.test._
import zio.test.Assertion._

test("handler succeeds with response") {
  val successHandler: Handler = Handler.ok("Success")
  
  for {
    response <- successHandler(Request.default)
  } yield {
    // Handler returns a response (either success or failure status)
    assertTrue(response.status.isInformational || 
              response.status.isSuccess || 
              response.status.isRedirection ||
              response.status.isClientError ||
              response.status.isServerError)
  }
}

test("handler returns failure response status") {
  val errorHandler: Handler = Handler { (_: Request) =>
    ZIO.succeed(Response.status(Status.InternalServerError))
  }
  
  for {
    response <- errorHandler(Request.default)
  } yield {
    // Check that status indicates error
    assertTrue(response.status.isServerError)
  }
}

test("successful response status") {
  val handler = Handler.ok("data")
  
  for {
    response <- handler(Request.default)
  } yield {
    // Check success status
    assert(response.status)(
      equalTo(Status.Ok)
    )
  }
}

test("handler error handling") {
  val handler: Handler = Handler { (req: Request) =>
    val id = req.url.path.segments.headOption
    id match {
      case Some(_) => ZIO.succeed(Response.ok)
      case None => ZIO.succeed(Response.status(Status.BadRequest))
    }
  }
  
  for {
    badRequest <- handler(Request.default.updateURL(_.withPath(Path("/"))))
    goodRequest <- handler(Request.default.updateURL(_.withPath(Path("/123"))))
  } yield {
    // Verify error and success cases
    assertTrue(
      badRequest.status.isClientError,
      goodRequest.status.isSuccess
    )
  }
}
```

---

## Combining Assertions

### Multiple Assertions with AND (&&)

Combine multiple assertions that must all be true.

```scala
import zio._
import zio.http._
import zio.test._
import zio.test.Assertion._

test("response passes all checks") {
  for {
    client <- ZIO.service[Client]
    response <- client.url(URL.decode("http://localhost/api/complete").toOption.get).get
    body <- response.body.asString
  } yield {
    // All assertions must pass
    assert(response)(
      hasField[Response, Status]("status", _.status, equalTo(Status.Ok))
    ) &&
    assert(response.headers.get(Header.ContentType))(
      isSome(containsString("json"))
    ) &&
    assert(body)(
      containsString("data") && containsString("timestamp")
    )
  }
}
```

### Multiple Assertions with assertTrue

Combine conditions in a single assertTrue call.

```scala
test("multiple conditions in assertTrue") {
  for {
    response <- Handler.ok("Hello World").mapResponse(
      _.addHeaders(Headers(Header.ContentType(MediaType.text.plain)))
    )(Request.default)
    body <- response.body.asString
  } yield {
    // Multiple conditions in one assertion
    assertTrue(
      response.status == Status.Ok,
      body.contains("Hello"),
      response.headers.get(Header.ContentType).isDefined,
      body.length > 5
    )
  }
}
```

### Conditional Assertions

Assert different things based on response characteristics.

```scala
test("conditional assertions based on status") {
  for {
    client <- ZIO.service[Client]
    response <- client.url(URL.decode("http://localhost/api/item").toOption.get).get
    body <- response.body.asString
  } yield {
    if (response.status == Status.Ok) {
      // For success, check body contains data
      assertTrue(body.nonEmpty)
    } else if (response.status == Status.NotFound) {
      // For 404, check error message
      assertTrue(body.contains("not found") || body.isEmpty)
    } else {
      // For other errors
      assertTrue(response.status.isClientError || response.status.isServerError)
    }
  }
}
```

---

## Common HTTP Testing Patterns

### Asserting Request/Response Cycle

```scala
test("complete request/response cycle") {
  val handler: Handler = Handler { (req: Request) =>
    val path = req.url.path.toString
    ZIO.succeed(Response.ok(s"Received request to $path"))
  }
  
  for {
    request <- ZIO.succeed(Request.default.updateURL(_.withPath(Path("/api/test"))))
    response <- handler(request)
    body <- response.body.asString
  } yield {
    assertTrue(
      response.status == Status.Ok,
      body.contains("/api/test")
    )
  }
}
```

### Asserting Error Responses

```scala
test("error response validation") {
  val handler: Handler = Handler { (req: Request) =>
    val required = req.headers.get("X-Required")
    if (required.isEmpty) {
      ZIO.succeed(
        Response.status(Status.BadRequest)
          .copy(body = Body.fromString("Missing required header"))
      )
    } else {
      ZIO.succeed(Response.ok)
    }
  }
  
  val badRequest = Request.default
  val goodRequest = Request.default.addHeaders(Headers(Header.Custom("X-Required", "yes")))
  
  for {
    badResponse <- handler(badRequest)
    goodResponse <- handler(goodRequest)
    badBody <- badResponse.body.asString
  } yield {
    assertTrue(
      badResponse.status == Status.BadRequest,
      badBody.contains("Missing required header"),
      goodResponse.status == Status.Ok
    )
  }
}
```

### Asserting Multiple Responses

```scala
test("multiple endpoints validation") {
  val routes = Routes(
    Method.GET / "health" -> Handler.ok("OK"),
    Method.GET / "data" -> Handler.ok("""{"count":42}"""),
    Method.GET / "missing" -> Handler.status(Status.NotFound)
  )
  
  val testCases = List(
    ("http://localhost/health", Status.Ok),
    ("http://localhost/data", Status.Ok),
    ("http://localhost/missing", Status.NotFound)
  )
  
  ZIO.foreach(testCases) { case (path, expectedStatus) =>
    for {
      client <- ZIO.service[Client]
      response <- client.url(URL.decode(path).toOption.get).get
    } yield {
      assertTrue(response.status == expectedStatus)
    }
  }.map(results => assertTrue(results.forall(identity)))
}
```
