import zio._
import zio.http._
import zio.test._
import zio.test.Assertion._

/**
 * Example: TestClient Body Testing
 *
 * This example demonstrates handling request and response bodies with TestClient.
 * You'll learn to send JSON/form bodies, extract and validate response bodies,
 * and test header-based request handling.
 *
 * Use these patterns for:
 * - Testing POST requests with JSON bodies
 * - Extracting and validating response bodies
 * - Testing form-encoded requests
 * - Testing header-based routing and validation
 * - Testing handlers that check request content
 */
object TestClientBodyExample extends ZIOSpecDefault {

  def spec = suite("TestClientBodyTesting")(
    // Test 1: can test POST with JSON request body
    test("can test POST with JSON request body") {
      val routes = Routes(
        Method.POST / "users" -> handler { (req: Request) =>
          for {
            body <- req.body.asString
          } yield {
            if (body.contains("\"name\"")) {
              Response.status(Status.Created)
                .copy(body = Body.fromString("""{"id":"123","status":"created"}"""))
            } else {
              Response.badRequest
            }
          }
        }
      )

      for {
        client <- ZIO.service[Client]
        response <- client
          .url(URL.decode("http://localhost/users").toOption.get)
          .post("""{"name":"Alice","age":30}""")
        responseBody <- response.body.asString
      } yield assertTrue(
        response.status == Status.Created,
        responseBody.contains("\"id\":\"123\"")
      )
    },

    // Test 2: can extract and validate response body
    test("can extract and validate response body") {
      val routes = Routes(
        Method.GET / "greeting" -> Handler.json(
          """{"message":"Hello, ZIO!","timestamp":"2024-01-01"}"""
        )
      )

      for {
        client <- ZIO.service[Client]
        response <- client
          .url(URL.decode("http://localhost/greeting").toOption.get)
          .get
        body <- response.body.asString
      } yield assertTrue(
        response.status == Status.Ok,
        body.contains("\"message\":\"Hello, ZIO!\""),
        body.contains("\"timestamp\"")
      )
    },

    // Test 3: can test form-encoded body
    test("can test form-encoded body") {
      val routes = Routes(
        Method.POST / "form" -> handler { (req: Request) =>
          for {
            body <- req.body.asString
          } yield {
            // Simple form parsing: username=john&password=secret
            if (body.contains("username=") && body.contains("password=")) {
              Response.ok.copy(body = Body.fromString("Form accepted"))
            } else {
              Response.badRequest
            }
          }
        }
      )

      for {
        client <- ZIO.service[Client]
        response <- client
          .url(URL.decode("http://localhost/form").toOption.get)
          .post("username=john&password=secret")
        body <- response.body.asString
      } yield assertTrue(
        response.status == Status.Ok,
        body == "Form accepted"
      )
    },

    // Test 4: handles empty request body
    test("handles empty request body") {
      val routes = Routes(
        Method.GET / "empty" -> handler { (req: Request) =>
          for {
            body <- req.body.asString
          } yield {
            if (body.isEmpty) {
              Response.text("Body is empty")
            } else {
              Response.text(s"Body length: ${body.length}")
            }
          }
        }
      )

      for {
        client <- ZIO.service[Client]
        response <- client
          .url(URL.decode("http://localhost/empty").toOption.get)
          .get
        body <- response.body.asString
      } yield assertTrue(
        response.status == Status.Ok,
        body == "Body is empty"
      )
    },

    // Test 5: header-based request handling
    test("header-based request handling") {
      val routes = Routes(
        Method.GET / "headers" -> handler { (req: Request) =>
          val hasAuth = req.headers.get(Header.Authorization).isDefined
          val contentType = req.headers.get(Header.ContentType)

          if (hasAuth) {
            ZIO.succeed(Response.text("Authorized"))
          } else {
            ZIO.succeed(Response.status(Status.Unauthorized))
          }
        }
      )

      for {
        client <- ZIO.service[Client]

        // Request without authorization header
        unauthorizedResponse <- client
          .url(URL.decode("http://localhost/headers").toOption.get)
          .get

        // Request with authorization header
        authorizedResponse <- client
          .url(URL.decode("http://localhost/headers").toOption.get)
          .header("Authorization", "Bearer token123")
          .get
        authorizedBody <- authorizedResponse.body.asString
      } yield assertTrue(
        unauthorizedResponse.status == Status.Unauthorized,
        authorizedResponse.status == Status.Ok,
        authorizedBody == "Authorized"
      )
    }
  ).provide(
    Client.default,
    Server.defaultWithApp(Http.collectHttp(Routes(
      Method.POST / "users" -> handler { (req: Request) =>
        for {
          body <- req.body.asString
        } yield {
          if (body.contains("\"name\"")) {
            Response.status(Status.Created)
              .copy(body = Body.fromString("""{"id":"123","status":"created"}"""))
          } else {
            Response.badRequest
          }
        }
      },
      Method.GET / "greeting" -> Handler.json(
        """{"message":"Hello, ZIO!","timestamp":"2024-01-01"}"""
      ),
      Method.POST / "form" -> handler { (req: Request) =>
        for {
          body <- req.body.asString
        } yield {
          if (body.contains("username=") && body.contains("password=")) {
            Response.ok.copy(body = Body.fromString("Form accepted"))
          } else {
            Response.badRequest
          }
        }
      },
      Method.GET / "empty" -> handler { (req: Request) =>
        for {
          body <- req.body.asString
        } yield {
          if (body.isEmpty) {
            Response.text("Body is empty")
          } else {
            Response.text(s"Body length: ${body.length}")
          }
        }
      },
      Method.GET / "headers" -> handler { (req: Request) =>
        val hasAuth = req.headers.get(Header.Authorization).isDefined

        if (hasAuth) {
          ZIO.succeed(Response.text("Authorized"))
        } else {
          ZIO.succeed(Response.status(Status.Unauthorized))
        }
      }
    )))
  )
}
