---
name: zio-http-imperative-to-declarative
description: Use when asked to refactor routes to use the Endpoint API, convert imperative handlers to typed endpoints, use type-safe endpoints, or modernize ZIO HTTP routes. Teaches the pattern for moving from imperative route handlers to the declarative, type-driven Endpoint API.
tags: [zio, zio-http, endpoints, declarative, refactoring, types]
---

# Convert Imperative Routes to Declarative Endpoints

Use this skill when a user asks to:
- **Refactor** imperative routes to the Endpoint API
- **Convert** handler functions to typed Endpoints
- **Use** type-safe endpoints in their ZIO HTTP app
- **Modernize** existing ZIO HTTP code
- **Add** type safety and OpenAPI docs to routes

## The Problem with Imperative Routes

Imperative route handlers require manual extraction of request data and mapping to responses:

```scala
val routes = Routes(
  Method.GET / "api" / "books" / string("id") -> handler { (req: Request) =>
    val id = req.pathParam("id")
    val limit = req.queryOrElse[Int]("limit", 10)
    
    if (id.isEmpty) {
      Response.status(Status.BadRequest)
    } else {
      Response.json(s"""{"id":"$id","limit":$limit}""")
    }
  }
)
```

**Problems:**
- No compile-time verification of request structure
- Error handling is manual and error-prone
- No OpenAPI documentation without writing it separately
- Client code must parse responses manually
- Path/query parameters are stringly-typed

---

## The Solution: Declarative Endpoints

The `Endpoint` API separates **what** your API looks like from **how** it works:

```scala
val getBooks = Endpoint(Method.GET / "api" / "books" / string("id"))
  .query(HttpCodec.query[Int]("limit"))
  .out[BooksResponse](Status.Ok)
  .outError[BadRequest](Status.BadRequest)
  .implement { (id: String, limit: Int) =>
    // Handler logic here — types are guaranteed
    ZIO.succeed(BooksResponse(id, limit))
  }
```

**Benefits:**
- ✓ Type-safe path and query parameters
- ✓ Compile-time validation of request/response shapes
- ✓ OpenAPI documentation auto-generated
- ✓ Type-safe client calls via `EndpointExecutor`
- ✓ Clear separation of description and logic

---

## Step 1: Define Your Domain Types

First, create typed models for request/response data:

```scala
import zio.schema._

case class Book(
  @description("Book ID")
  id: String,
  @description("Book title")
  title: String,
  @description("Author name")
  author: String
) derives Schema

case class CreateBookRequest(
  title: String,
  author: String
) derives Schema

case class BadRequest(error: String) derives Schema
case class NotFound(id: String) derives Schema
```

**Key point:** Use `derives Schema` to automatically generate ZIO Schema for your types. This powers type-safe codecs.

---

## Step 2: Define Endpoints

Create an object holding all your endpoint declarations (no logic yet):

```scala
import zio.http._
import zio.http.endpoint._

object BookEndpoints {
  // GET /api/books/:id?limit=10
  val getBook = Endpoint(Method.GET / "api" / "books" / string("id"))
    .query(HttpCodec.query[Int]("limit").optional)
    .out[Book](Status.Ok)
    .outError[NotFound](Status.NotFound)

  // POST /api/books
  val createBook = Endpoint(Method.POST / "api" / "books")
    .in[CreateBookRequest]
    .out[Book](Status.Created)
    .outError[BadRequest](Status.BadRequest)

  // DELETE /api/books/:id
  val deleteBook = Endpoint(Method.DELETE / "api" / "books" / string("id"))
    .out[Unit](Status.NoContent)
    .outError[NotFound](Status.NotFound)
}
```

**Key types:**

- **`Endpoint(...)`** — starts a new endpoint with a route pattern
- **`.query(...)`** — adds a typed query parameter
- **`.in[T]`** — request body type (must have `Schema[T]`)
- **`.out[T](Status.X)`** — response body type and HTTP status
- **`.outError[E](Status.Y)`** — error type and status (can chain multiple)

---

## Step 3: Implement Endpoints

Now bind business logic to your declared endpoints:

```scala
import zio._

object BookService {
  def getBook(id: String, limit: Option[Int]): IO[NotFound, Book] =
    if (id == "42") {
      ZIO.succeed(Book("42", "The Answer", "Douglas Adams"))
    } else {
      ZIO.fail(NotFound(id))
    }

  def createBook(req: CreateBookRequest): IO[BadRequest, Book] =
    if (req.title.isEmpty) {
      ZIO.fail(BadRequest("Title is required"))
    } else {
      ZIO.succeed(Book("999", req.title, req.author))
    }

  def deleteBook(id: String): IO[NotFound, Unit] =
    if (id == "42") {
      ZIO.succeed(())
    } else {
      ZIO.fail(NotFound(id))
    }
}
```

Now wire handlers:

```scala
val routes = Routes(
  BookEndpoints.getBook.implement { (id: String, limit: Option[Int]) =>
    BookService.getBook(id, limit)
  },
  BookEndpoints.createBook.implement { (req: CreateBookRequest) =>
    BookService.createBook(req)
  },
  BookEndpoints.deleteBook.implement { (id: String) =>
    BookService.deleteBook(id)
  }
)
```

**Key insight:** The handler receives **typed parameters** that exactly match your endpoint declaration. The framework handles serialization/deserialization automatically.

---

## Step 4: Serve Your API

```scala
import zio.http.endpoint.openapi._

object BookAPI extends ZIOAppDefault {
  val routes = Routes(
    BookEndpoints.getBook.implement { /* ... */ },
    BookEndpoints.createBook.implement { /* ... */ },
    BookEndpoints.deleteBook.implement { /* ... */ }
  )

  // Bonus: auto-generate OpenAPI documentation
  val openAPI = OpenAPIGen.fromEndpoints(
    title = "Book Store API",
    version = "1.0.0",
    endpoints = List(
      BookEndpoints.getBook,
      BookEndpoints.createBook,
      BookEndpoints.deleteBook
    )
  )

  val allRoutes = routes ++ SwaggerUI.routes("docs", openAPI)

  def run = Server.serve(allRoutes).provide(Server.default)
}
```

---

## Side-by-Side Comparison

### Before: Imperative

```scala
val routes = Routes(
  Method.POST / "api" / "books" -> handler { (req: Request) =>
    // Manual extraction
    val bodyStr <- req.body.asString
    val json = ujson.read(bodyStr)
    
    val title = json("title").str
    val author = json("author").str
    
    if (title.isEmpty) {
      Response.status(Status.BadRequest)
    } else {
      val book = Book("999", title, author)
      Response.json(ujson.write(book))
    }
  }
)
```

**Problems:**
- No type checking until runtime
- Error handling is manual
- Each endpoint must implement its own validation
- Response shape is a string

### After: Declarative

```scala
object BookEndpoints {
  val createBook = Endpoint(Method.POST / "api" / "books")
    .in[CreateBookRequest]
    .out[Book](Status.Created)
    .outError[BadRequest](Status.BadRequest)
}

val routes = Routes(
  BookEndpoints.createBook.implement { (req: CreateBookRequest) =>
    if (req.title.isEmpty) {
      ZIO.fail(BadRequest("Title required"))
    } else {
      ZIO.succeed(Book("999", req.title, req.author))
    }
  }
)
```

**Benefits:**
- Types guarantee request structure
- Status codes are explicit
- Error types map to responses automatically
- Testable without HTTP
- OpenAPI docs auto-generated

---

## Advanced Patterns

### Path Parameters

```scala
val getBook = Endpoint(Method.GET / "api" / "books" / int("id"))
  .out[Book](Status.Ok)

val routes = Routes(
  getBook.implement { (id: Int) =>  // id is Int, not String
    ZIO.succeed(Book(id.toString, "Title", "Author"))
  }
)
```

Supported extractors: `int(...)`, `string(...)`, `long(...)`, `uuid(...)`, `trailing`.

### Multiple Query Parameters

```scala
val search = Endpoint(Method.GET / "api" / "books")
  .query(HttpCodec.query[String]("title").optional)
  .query(HttpCodec.query[Int]("page").optional)
  .query(HttpCodec.query[Int]("limit").optional)
  .out[Chunk[Book]](Status.Ok)

val routes = Routes(
  search.implement { (title: Option[String], page: Option[Int], limit: Option[Int]) =>
    // All parameters are typed and optional
    ZIO.succeed(Chunk.empty)
  }
)
```

### Authentication

```scala
val getSecretBooks = Endpoint(Method.GET / "api" / "books" / "secret")
  .auth(AuthType.Bearer)  // Require Bearer token
  .out[Chunk[Book]](Status.Ok)
  .outError[Unauthorized](Status.Unauthorized)

val routes = Routes(
  getSecretBooks.implement { (token: String) =>
    // Token is automatically extracted from Authorization header
    if (validateToken(token)) {
      ZIO.succeed(Chunk.empty)
    } else {
      ZIO.fail(Unauthorized())
    }
  }
)
```

### Headers

```scala
val customHeader = Endpoint(Method.GET / "api" / "books")
  .header(HeaderCodec.custom("X-Custom-Header"))
  .out[Chunk[Book]](Status.Ok)

val routes = Routes(
  customHeader.implement { (customValue: String) =>
    ZIO.succeed(Chunk.empty)
  }
)
```

---

## Refactoring Checklist

When converting an imperative route to declarative:

- [ ] Extract request/response types into case classes with `derives Schema`
- [ ] Create an `Endpoint(...)` declaration with route pattern
- [ ] Add `.query(...)` for each query parameter
- [ ] Add `.in[RequestType]` for request body
- [ ] Add `.out[ResponseType](Status.X)` for success response
- [ ] Add `.outError[ErrorType](Status.Y)` for each error case
- [ ] Implement the endpoint with a handler that receives typed parameters
- [ ] Test with the typed handler (no HTTP needed)
- [ ] Generate OpenAPI docs with `OpenAPIGen.fromEndpoints`

---

## Key Types

- **`Endpoint[PathInput, Input, Err, Output, Auth]`** — fully typed endpoint description
- **`HttpCodec`** — codec for query params, headers, bodies
- **`AuthType`** — authentication requirement (None, Basic, Bearer, Digest, Custom, Or)
- **`handler(...)`** — converts a function to a `Handler`
- **`.implement(...)`** — binds a handler to an endpoint

---

## Next Steps

- **Type-safe client** — Use `EndpointExecutor` to call typed endpoints
- **Documentation** — Add `Doc.p(...)` for OpenAPI (see `zio-http-endpoint-to-openapi`)
- **Middleware** — Add logging, auth, CORS to routes with `@@`
- **Testing** — Test handlers with `zio-http-testkit` without spinning up a server

---

## Common Failures

| Symptom                                                                   | Likely cause                                                                | Fix                                                                                                                  |
|---------------------------------------------------------------------------|-----------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------|
| `not found: type Schema` or `Schema[T]`                                   | Missing `zio-schema` dep or missing `DeriveSchema.gen` for case class.      | Add `"dev.zio" %% "zio-schema-derivation"`; `implicit val schema: Schema[T] = DeriveSchema.gen` for each type.       |
| `value implement is not a member of Endpoint[...]`                        | Imperative-style binding used; Endpoint expects a typed handler.            | Use `endpoint.implement { case (path, query) => ... }`. The lambda must match the endpoint's input arity.            |
| Compile error: `lambda parameter count mismatch`                          | Handler arity doesn't match the endpoint's typed input.                     | An endpoint with `Method.GET / "x" / int("id")` plus `.query(...)` produces `(Int, Option[Q]) => …`.               |
| Endpoint compiles but returns 404 at runtime                              | Routes object built from endpoints not bound to the server, or path typo.   | Pass `Routes(...)` to `Server.serve(...)`; verify the endpoint's path string matches the request URL.                |
| Migration leaves an unused `Request => Response` handler somewhere         | Imperative residue not removed during refactor.                             | Search for `handler {` blocks and confirm each is either deleted or paired with a typed endpoint via `.implement`.   |

---

## References

- **Complete runnable companion example**: [`references/examples/BookEndpointsApp.scala`](references/examples/BookEndpointsApp.scala) — combines the snippets shown across Steps 2–4 into a single runnable file (data types, endpoint declarations, service logic, routes, OpenAPI + Swagger UI). Read this first when you want a copy-paste starting point instead of stitching the snippets together.
- [Endpoint API GitHub](https://github.com/zio/zio-http/blob/main/zio-http/src/main/scala/zio/http/endpoint/Endpoint.scala)
- [ImperativeProgrammingExample.scala](https://github.com/zio/zio-http/blob/main/zio-http-example/src/main/scala/example/endpoint/style/ImperativeProgrammingExample.scala)
- [DeclarativeProgrammingExample.scala](https://github.com/zio/zio-http/blob/main/zio-http-example/src/main/scala/example/endpoint/style/DeclarativeProgrammingExample.scala)
- [BooksEndpointExample.scala](https://github.com/zio/zio-http/blob/main/zio-http-example/src/main/scala/example/endpoint/BooksEndpointExample.scala)
- [ZIO Schema Documentation](https://zio.dev/zio-schema)
