import zio._
import zio.http._
import zio.test._
import zio.test.Assertion._

/**
 * Example: Direct Handler Testing
 *
 * This example demonstrates testing handlers directly without Routes or TestClient.
 * Handlers are functions from Request to ZIO[R, Response, Response].
 *
 * Use direct handler testing for:
 * - Unit testing pure logic in handlers
 * - Testing request parsing and validation
 * - Testing with no I/O or minimal setup
 * - Fastest tests with zero server overhead
 */
object BasicHandlerTestExample extends ZIOSpecDefault {

  def spec = suite("BasicHandlerTesting")(
    // Test 1: Handler.ok returns 200 OK
    test("Handler.ok returns 200 OK status") {
      val handler = Handler.ok("Success")
      val request = Request.default

      for {
        response <- handler(request)
      } yield assertTrue(response.status == Status.Ok)
    },

    // Test 2: Handler.text returns response with body content
    test("Handler.text returns response with body") {
      val handler = Handler.text("Hello, World!")
      val request = Request.default

      for {
        response <- handler(request)
        body <- response.body.asString
      } yield assertTrue(
        response.status == Status.Ok,
        body == "Hello, World!"
      )
    },

    // Test 3: Handler.status returns specific status code
    test("Handler.status returns specific status code") {
      val handler = Handler.status(Status.Created)
      val request = Request.default

      for {
        response <- handler(request)
      } yield assertTrue(response.status == Status.Created)
    },

    // Test 4: fromFunctionZIO allows custom logic with query parameters
    test("Handler from fromFunctionZIO reads query parameters") {
      val handler: Handler = Handler.fromFunctionZIO { (req: Request) =>
        val name = req.queryParam("name").getOrElse("Guest")
        ZIO.succeed(Response.text(s"Hello, $name!"))
      }

      val request = Request.default
        .updateURL(_.withQueryParams(QueryParams("name" -> "Alice")))

      for {
        response <- handler(request)
        body <- response.body.asString
      } yield assertTrue(
        response.status == Status.Ok,
        body == "Hello, Alice!"
      )
    },

    // Test 5: Handler.fail returns error
    test("Handler.fail produces failure") {
      val handler: Handler = Handler { (_: Request) =>
        ZIO.fail(Response.badRequest)
      }

      val request = Request.default

      for {
        exit <- handler(request).exit
      } yield assertTrue(exit.isFailure)
    },

    // Test 6: Custom handler with conditional logic
    test("Custom handler with conditional logic") {
      val handler: Handler = Handler { (req: Request) =>
        val id = req.url.path.segments.lastOption
        id match {
          case Some(idValue) =>
            ZIO.succeed(Response.text(s"User ID: $idValue"))
          case None =>
            ZIO.succeed(Response.status(Status.BadRequest))
        }
      }

      for {
        // Test with valid ID
        validRequest <- ZIO.succeed(
          Request.default.updateURL(_.withPath(Path("/users/123")))
        )
        validResponse <- handler(validRequest)
        validBody <- validResponse.body.asString

        // Test without ID
        invalidRequest <- ZIO.succeed(
          Request.default.updateURL(_.withPath(Path("/users/")))
        )
        invalidResponse <- handler(invalidRequest)
      } yield assertTrue(
        validResponse.status == Status.Ok,
        validBody == "User ID: 123",
        invalidResponse.status == Status.BadRequest
      )
    }
  )
}
