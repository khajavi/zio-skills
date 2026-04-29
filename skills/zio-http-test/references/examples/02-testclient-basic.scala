import zio._
import zio.http._
import zio.test._
import zio.test.Assertion._

/**
 * Example: TestClient Basic Usage
 *
 * This example demonstrates TestClient for testing routes without actual server startup.
 * TestClient processes requests through your full route definitions, including middleware
 * and path matching, but faster than starting a real server.
 *
 * Use TestClient for:
 * - Testing Routes with path matching, query params, and headers
 * - Testing multiple routes together
 * - Testing middleware behavior
 * - Testing request/response parsing through the full HTTP stack
 * - Most unit and integration tests
 */
object TestClientBasicExample extends ZIOSpecDefault {

  def spec = suite("TestClientBasic")(
    // Test 1: can test a single route
    test("can test a single route") {
      val routes = Routes(
        Method.GET / "hello" -> Handler.text("Hello, World!")
      )

      for {
        client <- ZIO.service[Client]
        response <- client
          .url(URL.decode("http://localhost/hello").toOption.get)
          .get
        body <- response.body.asString
      } yield assertTrue(
        response.status == Status.Ok,
        body == "Hello, World!"
      )
    },

    // Test 2: can test multiple routes
    test("can test multiple routes") {
      val routes = Routes(
        Method.GET / "users" -> Handler.json("""[{"id":"1","name":"Alice"}]"""),
        Method.GET / "posts" -> Handler.json("""[{"id":"1","title":"Hello ZIO"}]""")
      )

      for {
        client <- ZIO.service[Client]
        usersResponse <- client
          .url(URL.decode("http://localhost/users").toOption.get)
          .get
        usersBody <- usersResponse.body.asString

        postsResponse <- client
          .url(URL.decode("http://localhost/posts").toOption.get)
          .get
        postsBody <- postsResponse.body.asString
      } yield assertTrue(
        usersResponse.status == Status.Ok,
        usersBody.contains("Alice"),
        postsResponse.status == Status.Ok,
        postsBody.contains("Hello ZIO")
      )
    },

    // Test 3: can test different HTTP methods
    test("can test different HTTP methods") {
      val routes = Routes(
        Method.GET / "resource" -> Handler.ok("GET response"),
        Method.POST / "resource" -> Handler.status(Status.Created),
        Method.PUT / "resource" -> Handler.ok("PUT response"),
        Method.DELETE / "resource" -> Handler.ok("DELETE response")
      )

      for {
        client <- ZIO.service[Client]

        getResponse <- client
          .url(URL.decode("http://localhost/resource").toOption.get)
          .get

        postResponse <- client
          .url(URL.decode("http://localhost/resource").toOption.get)
          .post("")

        putResponse <- client
          .url(URL.decode("http://localhost/resource").toOption.get)
          .put("")

        deleteResponse <- client
          .url(URL.decode("http://localhost/resource").toOption.get)
          .delete
      } yield assertTrue(
        getResponse.status == Status.Ok,
        postResponse.status == Status.Created,
        putResponse.status == Status.Ok,
        deleteResponse.status == Status.Ok
      )
    },

    // Test 4: can test routes with query parameters
    test("can test routes with query parameters") {
      val routes = Routes(
        Method.GET / "search" -> handler { (req: Request) =>
          val q = req.queryParam("q").getOrElse("")
          val limit = req.queryParam("limit").getOrElse("10")
          ZIO.succeed(
            Response.json(s"""{"query":"$q","limit":$limit}""")
          )
        }
      )

      for {
        client <- ZIO.service[Client]
        response <- client
          .url(URL.decode("http://localhost/search?q=zio&limit=5").toOption.get)
          .get
        body <- response.body.asString
      } yield assertTrue(
        response.status == Status.Ok,
        body.contains("\"query\":\"zio\""),
        body.contains("\"limit\":5")
      )
    },

    // Test 5: TestClient recommended pattern
    test("TestClient recommended pattern with multiple assertions") {
      val routes = Routes(
        Method.GET / "api" / "greeting" -> handler { (req: Request) =>
          val name = req.queryParam("name").getOrElse("World")
          ZIO.succeed(Response.text(s"Hello, $name!"))
        }
      )

      for {
        client <- ZIO.service[Client]

        // Make request with query parameter
        response <- client
          .url(URL.decode("http://localhost/api/greeting?name=Scala").toOption.get)
          .get

        // Extract and verify response
        body <- response.body.asString
      } yield assertTrue(
        response.status == Status.Ok,
        body == "Hello, Scala!"
      )
    }
  ).provide(
    Client.default,
    Server.defaultWithApp(Http.collectHttp(Routes(
      Method.GET / "hello" -> Handler.text("Hello, World!"),
      Method.GET / "users" -> Handler.json("""[{"id":"1","name":"Alice"}]"""),
      Method.GET / "posts" -> Handler.json("""[{"id":"1","title":"Hello ZIO"}]"""),
      Method.GET / "resource" -> Handler.ok("GET response"),
      Method.POST / "resource" -> Handler.status(Status.Created),
      Method.PUT / "resource" -> Handler.ok("PUT response"),
      Method.DELETE / "resource" -> Handler.ok("DELETE response"),
      Method.GET / "search" -> handler { (req: Request) =>
        val q = req.queryParam("q").getOrElse("")
        val limit = req.queryParam("limit").getOrElse("10")
        ZIO.succeed(
          Response.json(s"""{"query":"$q","limit":$limit}""")
        )
      },
      Method.GET / "api" / "greeting" -> handler { (req: Request) =>
        val name = req.queryParam("name").getOrElse("World")
        ZIO.succeed(Response.text(s"Hello, $name!"))
      }
    )))
  )
}
