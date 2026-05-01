---
name: zio-http-endpoint-to-openapi
description: Use when asked to generate OpenAPI documentation from ZIO HTTP Endpoints, add Swagger UI to an API, document endpoints, or export an API definition. Generates OpenAPI 3.0 specs from typed Endpoint declarations and serves Swagger UI.
tags: [zio, zio-http, openapi, documentation, swagger]
---

# Generate OpenAPI Documentation from Endpoints

Use this skill when a user asks to:
- **Generate OpenAPI** from ZIO HTTP endpoints
- **Add Swagger UI** to their API
- **Document** their API endpoints
- **Export** API definition as OpenAPI JSON
- **Create** an interactive API explorer

## Overview

The ZIO HTTP `Endpoint` API gives you type-safe route definitions. The same type information that makes your code type-safe can also generate complete OpenAPI 3.0 documentation automatically. No duplicate documentation to maintain.

---

## Step 1: Define Endpoints with Documentation

Use ZIO Schema's `@description` annotation and ZIO HTTP's `Doc` type to document your endpoints:

```scala
import zio._
import zio.http._
import zio.http.endpoint._
import zio.schema._

case class Book(
  @description("Unique book identifier")
  id: Int,
  @description("Book title")
  title: String,
  @description("ISBN-13")
  isbn: String
) derives Schema

case class BookNotFound(id: Int) derives Schema

object BookEndpoints {
  // GET /api/books/:id
  val getBook = Endpoint(Method.GET / "api" / "books" / int("id"))
    .out[Book](Status.Ok)
    .outError[BookNotFound](Status.NotFound)
    .doc(Doc.p("Retrieve a book by ID"))

  // POST /api/books
  val createBook = Endpoint(Method.POST / "api" / "books")
    .in[Book]
    .out[Book](Status.Created)
    .doc(Doc.p("Create a new book"))

  // GET /api/books?limit=10&offset=0
  val listBooks = Endpoint(Method.GET / "api" / "books")
    .query(HttpCodec.query[Int]("limit").optional)
    .query(HttpCodec.query[Int]("offset").optional)
    .out[Chunk[Book]](Status.Ok)
    .doc(Doc.p("List all books with pagination"))
}
```

**Key documentation elements:**

- **`@description`** on case class fields — documents request/response properties
- **`.doc(Doc.p(...))`** on endpoints — overall endpoint description
- **Status codes** in `.out[T](Status.X)` — OpenAPI automatically includes these
- **Error types** in `.outError[E](Status.Y)` — mapped to response schemas

---

## Step 2: Generate OpenAPI Spec

```scala
import zio.http.endpoint.openapi._

object MyAPI extends ZIOAppDefault {
  val routes = Routes(
    BookEndpoints.getBook.implement { id =>
      ZIO.fail(BookNotFound(id))
    },
    BookEndpoints.createBook.implement { book =>
      ZIO.succeed(book.copy(id = 999))
    },
    BookEndpoints.listBooks.implement { (limit, offset) =>
      ZIO.succeed(Chunk(
        Book(1, "Scala by Example", "978-3-906390-06-9"),
        Book(2, "Programming in Scala", "978-0-98153-161-1")
      ))
    }
  )

  // Generate OpenAPI specification
  val openAPI = OpenAPIGen.fromEndpoints(
    title = "Book Store API",
    version = "1.0.0",
    routes.collect { case r: Route.Handled[_, _, _] => r.endpoint }.toList
  )

  def run = Server.serve(routes ++ SwaggerUI.routes("docs" / "openapi", openAPI))
    .provide(Server.default)
}
```

**Key types:**

- **`OpenAPIGen.fromEndpoints(...)`** — generates `OpenAPI` model from endpoints
- **`SwaggerUI.routes(path, openAPI*)`** — creates routes that:
  - Serve Swagger UI at `GET /docs/openapi`
  - Serve OpenAPI JSON at `GET /docs/openapi/openapi.json`
  - Serve ReDoc (alternative UI) at `GET /docs/openapi/redoc`

---

## Step 3: Mount Swagger UI with Your App

Compose Swagger UI routes with your application routes:

```scala
val allRoutes = 
  // Your API routes
  bookRoutes ++
  // Swagger UI documentation
  SwaggerUI.routes("docs" / "openapi", openAPI)

def run = Server.serve(allRoutes).provide(Server.default)
```

Now your API is documented and interactive:
- **Swagger UI:** `http://localhost:8080/docs/openapi`
- **OpenAPI JSON:** `http://localhost:8080/docs/openapi/openapi.json`
- **ReDoc:** `http://localhost:8080/docs/openapi/redoc`

---

## Full Example

```scala
import zio._
import zio.http._
import zio.http.endpoint._
import zio.http.endpoint.openapi._
import zio.schema._

// Domain model
case class Book(
  @description("Unique identifier")
  id: Int,
  @description("Book title")
  title: String
) derives Schema

case class BookNotFound(id: Int) derives Schema

// Endpoints with documentation
object BookEndpoints {
  val getBook = 
    Endpoint(Method.GET / "api" / "books" / int("id"))
      .out[Book](Status.Ok)
      .outError[BookNotFound](Status.NotFound)
      .doc(Doc.p("Get a book by ID"))

  val createBook = 
    Endpoint(Method.POST / "api" / "books")
      .in[Book]
      .out[Book](Status.Created)
      .doc(Doc.p("Create a new book"))
}

// API implementation
object BookAPI extends ZIOAppDefault {
  val routes = Routes(
    BookEndpoints.getBook.implement { id =>
      ZIO.succeed(Book(id, s"Book #$id"))
    },
    BookEndpoints.createBook.implement { book =>
      ZIO.succeed(book.copy(id = 999))
    }
  )

  // Generate and serve OpenAPI docs
  val openAPI = OpenAPIGen.fromEndpoints(
    title = "Book API",
    version = "1.0.0",
    // Collect all endpoints from routes
    endpoints = List(
      BookEndpoints.getBook,
      BookEndpoints.createBook
    )
  )

  val allRoutes = routes ++ SwaggerUI.routes("docs" / "openapi", openAPI)

  def run = Server.serve(allRoutes).provide(Server.default)
}
```

Run with `sbt run`, then visit `http://localhost:8080/docs/openapi` to see your interactive API docs.

---

## Advanced Documentation

### Multiple Error Types

```scala
val endpoint = Endpoint(Method.POST / "api" / "books")
  .in[Book]
  .out[Book](Status.Created)
  .outError[BookNotFound](Status.NotFound)
  .outError[ValidationError](Status.BadRequest)
  .outError[Unauthorized](Status.Unauthorized)
  .doc(Doc.p("Create a new book (requires authentication)"))
```

All error types automatically become OpenAPI response schemas.

### Query and Header Documentation

```scala
val search = Endpoint(Method.GET / "api" / "books")
  .query(
    HttpCodec.query[String]("title")
      .doc(Doc.p("Filter by book title"))
  )
  .header(HeaderCodec.authorization.doc(Doc.p("Bearer token required")))
  .out[Chunk[Book]](Status.Ok)
```

### Response Examples

```scala
val example = Book(
  id = 1,
  title = "Programming in Scala"
)

val endpoint = Endpoint(Method.GET / "api" / "books" / int("id"))
  .out[Book](Status.Ok)
  .doc(Doc.p("Get a book"))
```

Schema documentation is auto-derived from ZIO Schema definitions.

---

## Export OpenAPI JSON

To save the generated OpenAPI spec to a file:

```scala
import java.nio.file.Files
import java.nio.file.Paths

val openAPIJson = openAPI.toJson
Files.writeString(
  Paths.get("openapi.json"),
  openAPIJson
)
```

This JSON can be imported into other tools like Postman, Insomnia, or API registries.

---

## Key Types

- **`OpenAPIGen`** — generates OpenAPI model from endpoints
- **`OpenAPI`** — the OpenAPI 3.0 document; call `.toJson` to export as JSON
- **`SwaggerUI.routes(...)`** — creates routes that serve Swagger UI and JSON spec
- **`Doc.p(...)`** — documentation paragraph (also `Doc.h(...)`for headers, etc.)
- **`@description`** — ZIO Schema annotation for field documentation

---

## Next Steps

- **Share with teams** — Export the OpenAPI JSON and share with frontend teams, QA, or API gateway operators
- **Code generation** — Use the OpenAPI spec to generate clients in other languages (OpenAPI generators)
- **Validation** — Reference the spec in CI/CD to ensure API contracts don't break
- **API versioning** — Version your API by changing the `version` parameter

---

## Common Failures

| Symptom                                                              | Likely cause                                                                 | Fix                                                                                                                  |
|----------------------------------------------------------------------|------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------|
| Generated spec is missing field descriptions                         | Endpoint missing `@description` annotations, or schemas missing `?? "..."`.  | Add `@description("…")` on case-class fields and `?? "…"` on endpoint codecs to enrich the generated spec.            |
| `OpenAPIGen.fromEndpoints` returns an empty spec                     | Empty list of endpoints, or wrong type.                                      | Pass each `Endpoint` value as a separate argument; verify the list contains entries before calling.                  |
| Swagger UI loads but says "Failed to load API definition"            | Mounted path mismatch between `SwaggerUI.routes("docs", openAPI)` and the UI's fetch URL. | The path passed as first arg to `SwaggerUI.routes` is where the spec is served — align the UI URL.            |
| Multiple errors collapsed into one in the spec                       | `.outError[E1]` followed by `.outError[E2]` — the second replaces the first. | Use `.outErrors[E1, E2]` (one call), or keep separate endpoints per error type.                                      |
| Codegen complains about missing types in the generated spec          | Some types referenced but lack `Schema` instances.                           | Derive `Schema` for every type used in `.in[T]` / `.out[T]` / `.outError[E]`. Use `DeriveSchema.gen`.                 |

---

## References

- [OpenAPIGen GitHub](https://github.com/zio/zio-http/blob/main/zio-http/src/main/scala/zio/http/endpoint/openapi/OpenAPIGen.scala)
- [SwaggerUI Documentation](https://swagger.io/tools/swagger-ui/)
- [BooksEndpointExample.scala](https://github.com/zio/zio-http/blob/main/zio-http-example/src/main/scala/example/endpoint/BooksEndpointExample.scala)
- [OpenAPI 3.0 Spec](https://spec.openapis.org/oas/v3.0.3)
