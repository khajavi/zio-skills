---
name: zio-http-scaffold
description: Use when asked to scaffold a ZIO HTTP server, create a hello world route, set up a client, or build a new ZIO HTTP application. Provides the canonical minimal setup for starting ZIO HTTP projects.
tags: [zio, zio-http, scala, server, client, scaffolding]
---

# Scaffold a ZIO HTTP Server + Client

Use this skill when a user asks to:
- **Scaffold** a new ZIO HTTP server from scratch
- **Create** a hello world ZIO HTTP application
- **Build** a simple ZIO HTTP server with routes
- **Set up** a client to connect to a ZIO HTTP server
- **Start** a ZIO HTTP project with a working example

## Step 1: Add Dependency

Add to `build.sbt`:

```scala
libraryDependencies += "dev.zio" %% "zio-http" % "3.3.2"
```

The latest version is available on [Maven Central](https://central.sonatype.com/artifact/dev.zio/zio-http_3).

---

## Step 2: Create the Server

Create a file `src/main/scala/HelloWorldServer.scala`:

```scala
import zio._
import zio.http._

object HelloWorldServer extends ZIOAppDefault {
  // Define your routes
  val routes = Routes(
    Method.GET / Root -> handler(Response.text("Hello, World!")),
    Method.GET / "greet" -> handler { (req: Request) =>
      val name = req.queryOrElse[String]("name", "Guest")
      Response.text(s"Hello, $name!")
    }
  )

  // Start the server on localhost:8080
  def run = Server.serve(routes).provide(Server.default)
}
```

**Key types:**
- `Routes` — collection of routes for your server
- `Method.GET / "path"` — path pattern matching (method + path)
- `handler(...)` — converts a response or function into a Handler
- `Request` — incoming HTTP request; extract query params via `.queryOrElse[T]("name", default)`
- `Response` — HTTP response; `.text(...)`, `.json(...)`, `.html(...)`, etc.
- `Server.serve(routes)` — starts the server
- `Server.default` — ZLayer providing default server (localhost:8080)

---

## Step 3: Create a Client

Create a file `src/main/scala/HelloWorldClient.scala`:

```scala
import zio._
import zio.http._

object HelloWorldClient extends ZIOAppDefault {
  val app =
    for {
      // Acquire a client (automatically managed by ZIO)
      client <- ZIO.service[Client]
      
      // Make a GET request to the server
      response1 <- client.url(URL(Scheme.HTTP, "localhost", 8080) / "greet")
        .queryParam("name", "Alice")
        .batched(Request.get(""))
      
      text1 <- response1.body.asString
      _ <- Console.printLine(s"Response 1: $text1")
      
      // Another request
      response2 <- client.url(URL(Scheme.HTTP, "localhost", 8080) / "")
        .batched(Request.get(""))
      
      text2 <- response2.body.asString
      _ <- Console.printLine(s"Response 2: $text2")
    } yield ()

  def run = app.provide(Client.default)
}
```

**Key types:**
- `ZIO.service[Client]` — access the Client from the environment
- `client.url(url)` — set the base URL for requests
- `.queryParam(name, value)` — add query parameters
- `.batched(request)` — send a request and get back a Response
- `response.body.asString` — read the response body as a string
- `Client.default` — ZLayer providing a default HTTP client

---

## Step 4: Run Locally

**Terminal 1 — Start the server:**
```bash
sbt "run"
# or specifically:
# sbt "runMain HelloWorldServer"
```

You should see:
```
Started server on http://localhost:8080
```

**Terminal 2 — Run the client:**
```bash
sbt "runMain HelloWorldClient"
```

You should see:
```
Response 1: Hello, Alice!
Response 2: Hello, World!
```

---

## Common Patterns

### Adding More Routes

Routes are composable with `++`:

```scala
val routes =
  Routes(
    Method.GET / Root -> handler(Response.text("Home")),
    Method.GET / "api" / "users" -> handler(Response.json("""{"users": []}""")),
    Method.POST / "api" / "users" -> handler { (req: Request) =>
      // Handle POST
      Response.status(Status.Created)
    }
  ) ++ middlewareRoutes  // Combine with other routes
```

### Accessing Request Data

```scala
handler { (req: Request) =>
  // Query parameters
  val page = req.queryOrElse[Int]("page", 1)
  
  // Path parameters (requires Endpoint API — see zio-http-imperative-to-declarative)
  // Headers
  val contentType = req.header(Header.ContentType)
  
  // Request body (for POST/PUT)
  val bodyStr <- req.body.asString
  
  Response.text(s"page=$page, body=$bodyStr")
}
```

### Running with Custom Port

```scala
val customConfig = Server.Config.default
  .port(9000)

def run = Server.serve(routes).provide(ZLayer.succeed(customConfig) >>> Server.live)
```

---

## Next Steps

Once your basic server is working, explore:

- **Type-safe routes** — Use the `Endpoint` API (see `zio-http-imperative-to-declarative`)
- **Middleware** — Add logging, CORS, auth with `Middleware`
- **OpenAPI docs** — Generate Swagger UI (see `zio-http-endpoint-to-openapi`)
- **Error handling** — Map domain errors to HTTP responses
- **Testing** — Use `zio-http-testkit` for handler-level testing without a live server

---

## Common Failures

| Symptom                                                              | Likely cause                                                              | Fix                                                                                              |
|----------------------------------------------------------------------|---------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| `java.net.BindException: Address already in use`                     | Port 8080 (default) is already taken.                                     | Use a different port: `Server.defaultWith(_.port(9090))` or stop the other process.              |
| `Server.default` is not a member of object `Server`                  | Old `zio-http` version that pre-dates the layer rename.                   | Bump `zio-http` to ≥ 3.0; older releases used `Server.live`.                                     |
| `not a member of object zio.http.Routes`                             | API version mismatch between `Routes` and the Endpoint API.              | Verify all `zio-http*` artifacts share the same version in `build.sbt`.                          |
| Client request hangs forever                                         | Server not running, or client URL doesn't match the server's port.        | Confirm `Server started on http://0.0.0.0:8080` in the server log; align client URL.             |
| `java.lang.NoSuchMethodError` at runtime                             | Two `zio-http` versions on the classpath (via a transitive dep).          | Run `sbt evicted`; pin a single version with `dependencyOverrides`.                              |

---

## References

- [ZIO HTTP GitHub](https://github.com/zio/zio-http)
- [ZIO HTTP Documentation](https://zio.dev/zio-http)
- [HelloWorld Example](https://github.com/zio/zio-http/blob/main/zio-http-example/src/main/scala/example/HelloWorld.scala)
- [Simple Client Example](https://github.com/zio/zio-http/blob/main/zio-http-example/src/main/scala/example/SimpleClient.scala)
