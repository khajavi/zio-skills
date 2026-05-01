// BookEndpointsApp.scala — complete runnable example for the
// zio-http-imperative-to-declarative skill.
//
// Demonstrates the end-to-end declarative-endpoint pattern referenced from
// SKILL.md:
//   - data types (Book, CreateBookRequest, error types)
//   - endpoint declarations (BookEndpoints)
//   - business logic (BookService)
//   - route wiring + server (BookAPI)
//   - auto-generated OpenAPI documentation + Swagger UI
//
// Run with:
//   sbt "examples/runMain BookAPI"

import zio._
import zio.http._
import zio.http.endpoint._
import zio.http.endpoint.openapi._
import zio.schema.{DeriveSchema, Schema}

// ─── Data types ───────────────────────────────────────────────────────────────

final case class Book(id: String, title: String, author: String)
object Book {
  implicit val schema: Schema[Book] = DeriveSchema.gen
}

final case class CreateBookRequest(title: String, author: String)
object CreateBookRequest {
  implicit val schema: Schema[CreateBookRequest] = DeriveSchema.gen
}

final case class NotFound(id: String)
object NotFound {
  implicit val schema: Schema[NotFound] = DeriveSchema.gen
}

final case class BadRequest(message: String)
object BadRequest {
  implicit val schema: Schema[BadRequest] = DeriveSchema.gen
}

// ─── Endpoint declarations ────────────────────────────────────────────────────

object BookEndpoints {

  // GET /api/books/:id?limit=10
  val getBook =
    Endpoint(Method.GET / "api" / "books" / string("id"))
      .query(HttpCodec.query[Int]("limit").optional)
      .out[Book](Status.Ok)
      .outError[NotFound](Status.NotFound)

  // POST /api/books
  val createBook =
    Endpoint(Method.POST / "api" / "books")
      .in[CreateBookRequest]
      .out[Book](Status.Created)
      .outError[BadRequest](Status.BadRequest)

  // DELETE /api/books/:id
  val deleteBook =
    Endpoint(Method.DELETE / "api" / "books" / string("id"))
      .out[Unit](Status.NoContent)
      .outError[NotFound](Status.NotFound)
}

// ─── Business logic ───────────────────────────────────────────────────────────

object BookService {

  def getBook(id: String, limit: Option[Int]): IO[NotFound, Book] =
    if (id == "42") ZIO.succeed(Book("42", "The Answer", "Douglas Adams"))
    else            ZIO.fail(NotFound(id))

  def createBook(req: CreateBookRequest): IO[BadRequest, Book] =
    if (req.title.isEmpty) ZIO.fail(BadRequest("Title is required"))
    else                   ZIO.succeed(Book("999", req.title, req.author))

  def deleteBook(id: String): IO[NotFound, Unit] =
    if (id == "42") ZIO.unit
    else            ZIO.fail(NotFound(id))
}

// ─── Server entry point ───────────────────────────────────────────────────────

object BookAPI extends ZIOAppDefault {

  val routes = Routes(
    BookEndpoints.getBook.implement { case (id, limit) =>
      BookService.getBook(id, limit)
    },
    BookEndpoints.createBook.implement { req =>
      BookService.createBook(req)
    },
    BookEndpoints.deleteBook.implement { id =>
      BookService.deleteBook(id)
    },
  )

  // Auto-generate OpenAPI docs from the endpoint declarations.
  val openAPI = OpenAPIGen.fromEndpoints(
    title = "Book Store API",
    version = "1.0.0",
    endpoints = List(
      BookEndpoints.getBook,
      BookEndpoints.createBook,
      BookEndpoints.deleteBook,
    ),
  )

  val allRoutes = routes ++ SwaggerUI.routes("docs", openAPI)

  def run = Server.serve(allRoutes).provide(Server.default)
}
