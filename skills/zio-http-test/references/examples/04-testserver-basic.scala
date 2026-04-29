import zio._
import zio.http._
import zio.test._
import zio.test.Assertion._

/**
 * Example: TestServer Basic Integration Testing
 *
 * This example demonstrates TestServer for full server integration testing.
 * Unlike TestClient, TestServer starts a real server with actual port binding,
 * network behavior, and lifecycle management.
 *
 * Use TestServer for:
 * - Integration tests with real server startup
 * - Testing server lifecycle (startup, shutdown, resource cleanup)
 * - Testing with actual port binding and network calls
 * - Testing with external services or real databases
 * - Testing network-specific behavior (timeouts, connection pooling)
 *
 * Key difference from TestClient: Must retrieve port via
 * ZIO.serviceWithZIO[Server](_.port) and use it in URL construction.
 */
object TestServerBasicExample extends ZIOSpecDefault {

  def spec = suite("TestServerBasic")(
    // Test 1: can test with real server
    test("can test with real server on actual port") {
      val routes = Routes(
        Method.GET / "health" -> Handler.text("OK")
      )

      for {
        client <- ZIO.service[Client]
        server <- ZIO.service[Server]
        port <- server.port
        response <- client
          .url(
            URL(
              scheme = Scheme.HTTP,
              host = "localhost",
              port = port,
              path = Path("/health")
            )
          )
          .get
        body <- response.body.asString
      } yield assertTrue(
        response.status == Status.Ok,
        body == "OK"
      )
    },

    // Test 2: server handles multiple routes
    test("server handles multiple routes on real port") {
      val routes = Routes(
        Method.GET / "api" / "users" -> Handler.json("""[{"id":"1","name":"Alice"}]"""),
        Method.GET / "api" / "posts" -> Handler.json("""[{"id":"1","title":"First Post"}]""")
      )

      for {
        client <- ZIO.service[Client]
        server <- ZIO.service[Server]
        port <- server.port

        usersResponse <- client
          .url(
            URL(
              scheme = Scheme.HTTP,
              host = "localhost",
              port = port,
              path = Path("/api/users")
            )
          )
          .get
        usersBody <- usersResponse.body.asString

        postsResponse <- client
          .url(
            URL(
              scheme = Scheme.HTTP,
              host = "localhost",
              port = port,
              path = Path("/api/posts")
            )
          )
          .get
        postsBody <- postsResponse.body.asString
      } yield assertTrue(
        usersResponse.status == Status.Ok,
        usersBody.contains("Alice"),
        postsResponse.status == Status.Ok,
        postsBody.contains("First Post")
      )
    },

    // Test 3: server handles POST requests with body
    test("server handles POST requests with body") {
      val routes = Routes(
        Method.POST / "echo" -> handler { (req: Request) =>
          for {
            body <- req.body.asString
          } yield Response.text(s"You said: $body")
        }
      )

      for {
        client <- ZIO.service[Client]
        server <- ZIO.service[Server]
        port <- server.port

        response <- client
          .url(
            URL(
              scheme = Scheme.HTTP,
              host = "localhost",
              port = port,
              path = Path("/echo")
            )
          )
          .post("Hello, Server!")
        body <- response.body.asString
      } yield assertTrue(
        response.status == Status.Ok,
        body == "You said: Hello, Server!"
      )
    },

    // Test 4: server setup pattern - retrieving port and constructing URLs correctly
    test("server setup pattern with proper port retrieval") {
      val routes = Routes(
        Method.GET / "api" / "data" -> handler { (req: Request) =>
          val id = req.queryParam("id").getOrElse("unknown")
          ZIO.succeed(Response.json(s"""{"id":"$id","data":"test"}"""))
        }
      )

      // This pattern shows the recommended way to get the server port
      // and construct URLs for testing
      for {
        client <- ZIO.service[Client]
        server <- ZIO.service[Server]
        port <- server.port

        // Construct URL with actual server port
        url = URL(
          scheme = Scheme.HTTP,
          host = "localhost",
          port = port,
          path = Path("/api/data")
        ).copy(queryParams = QueryParams("id" -> "123"))

        response <- client.url(url).get
        body <- response.body.asString
      } yield assertTrue(
        response.status == Status.Ok,
        body.contains("\"id\":\"123\""),
        body.contains("\"data\":\"test\"")
      )
    }
  ).provide(
    Client.default,
    Server.defaultWithApp(Http.collectHttp(Routes(
      Method.GET / "health" -> Handler.text("OK"),
      Method.GET / "api" / "users" -> Handler.json("""[{"id":"1","name":"Alice"}]"""),
      Method.GET / "api" / "posts" -> Handler.json("""[{"id":"1","title":"First Post"}]"""),
      Method.POST / "echo" -> handler { (req: Request) =>
        for {
          body <- req.body.asString
        } yield Response.text(s"You said: $body")
      },
      Method.GET / "api" / "data" -> handler { (req: Request) =>
        val id = req.queryParam("id").getOrElse("unknown")
        ZIO.succeed(Response.json(s"""{"id":"$id","data":"test"}"""))
      }
    )))
  )
}
