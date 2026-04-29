import zio._
import zio.http._
import zio.http.endpoint._
import zio.test._
import zio.test.Assertion._

/**
 * Example: Endpoint API Testing
 *
 * This example demonstrates testing type-safe Endpoints.
 * Unlike imperative Routes, Endpoints provide compile-time type safety for both
 * request and response types. The HTTP stack handles serialization automatically.
 *
 * Key differences from Routes:
 * - Endpoints are more composable and reusable
 * - Type safety: path parameters and response types are checked at compile-time
 * - Automatic serialization/deserialization with zio-schema
 * - Better for building complex APIs incrementally
 *
 * Use Endpoints for:
 * - Building type-safe REST APIs
 * - Composing reusable endpoint definitions
 * - Automatic OpenAPI documentation generation
 * - Clear request/response contracts
 */
object EndpointAPITestExample extends ZIOSpecDefault {

  // Case class for User
  case class User(id: Int, name: String)

  // Test 1: can test type-safe endpoint with path parameter
  def spec = suite("EndpointAPITesting")(
    test("can test type-safe endpoint with path parameter") {
      // Define a simple endpoint: GET /api/users/{id} -> String
      val userEndpoint = Endpoint(Method.GET / "api" / "users" / int("id"))
        .outCodec(zio.schema.codec.JsonCodec.string)

      // Implement the endpoint
      val handler = userEndpoint.handler { id =>
        ZIO.succeed(s"User: $id")
      }

      val routes = Routes(
        userEndpoint.implementHandler(handler)
      )

      for {
        client <- ZIO.service[Client]
        response <- client
          .url(URL.decode("http://localhost/api/users/123").toOption.get)
          .get
        body <- response.body.asString
      } yield assertTrue(
        response.status == Status.Ok,
        body.contains("123") || body == "\"User: 123\""
      )
    },

    // Test 2: can test endpoint with request body and response body
    test("can test endpoint with request body") {
      // Define endpoint: POST /api/users with User input -> User output
      val createUserEndpoint =
        Endpoint(Method.POST / "api" / "users")
          .in[User]
          .out[User]

      // Simple implementation echoes back with incremented ID
      val handler = createUserEndpoint.handler { user =>
        ZIO.succeed(user.copy(id = user.id + 1))
      }

      val routes = Routes(
        createUserEndpoint.implementHandler(handler)
      )

      for {
        client <- ZIO.service[Client]
        response <- client
          .url(URL.decode("http://localhost/api/users").toOption.get)
          .post("""{"id":1,"name":"Alice"}""")
        body <- response.body.asString
      } yield assertTrue(
        response.status == Status.Ok,
        body.contains("Alice")
      )
    },

    // Test 3: endpoint error handling with specific status codes
    test("endpoint error handling with failure paths") {
      // Endpoint that can return either User or NotFound
      val getUserEndpoint = Endpoint(Method.GET / "api" / "users" / int("id"))
        .out[User]

      // Implementation that returns NotFound for certain IDs
      val handler = getUserEndpoint.handler { id =>
        if (id == 999) {
          ZIO.fail(Status.NotFound)
        } else {
          ZIO.succeed(User(id, s"User$id"))
        }
      }

      val routes = Routes(
        getUserEndpoint.implementHandler(handler)
      )

      for {
        client <- ZIO.service[Client]

        // Test success case
        successResponse <- client
          .url(URL.decode("http://localhost/api/users/1").toOption.get)
          .get
        successBody <- successResponse.body.asString

        // Test failure case
        failureResponse <- client
          .url(URL.decode("http://localhost/api/users/999").toOption.get)
          .get
      } yield assertTrue(
        successResponse.status == Status.Ok,
        successBody.contains("User1"),
        failureResponse.status == Status.NotFound
      )
    },

    // Test 4: endpoint with multiple parameters (path and query)
    test("endpoint with multiple parameters") {
      // Endpoint: GET /api/search/{query} with optional limit parameter
      val searchEndpoint = Endpoint(Method.GET / "api" / "search" / string("query"))
        .query(QueryCodec.queryParam("limit").map[Int](_.toIntOption.getOrElse(10)))
        .out[String]

      val handler = searchEndpoint.handler { case (query, limit) =>
        ZIO.succeed(s"Searching for '$query' with limit $limit")
      }

      val routes = Routes(
        searchEndpoint.implementHandler(handler)
      )

      for {
        client <- ZIO.service[Client]

        // Test with query parameter
        response1 <- client
          .url(URL.decode("http://localhost/api/search/zio?limit=5").toOption.get)
          .get
        body1 <- response1.body.asString

        // Test without explicit query parameter (uses default)
        response2 <- client
          .url(URL.decode("http://localhost/api/search/scala").toOption.get)
          .get
        body2 <- response2.body.asString
      } yield assertTrue(
        response1.status == Status.Ok,
        body1.contains("zio") || body1.contains("limit 5"),
        response2.status == Status.Ok,
        body2.contains("scala")
      )
    }
  ).provide(
    Client.default,
    Server.defaultWithApp(Http.collectHttp(Routes()))
  )
}
