---
name: zio-http-openapi-to-endpoint
description: Use when asked to generate ZIO HTTP Endpoints from an OpenAPI spec, code generate from OpenAPI, or import an OpenAPI definition. Generates type-safe Endpoint declarations from an existing OpenAPI JSON or YAML specification.
tags: [zio, zio-http, openapi, code-generation, code-gen]
---

# Generate Endpoint Declarations from OpenAPI Spec

Use this skill when a user asks to:
- **Generate endpoints** from an OpenAPI spec
- **Code generate** a ZIO HTTP API from OpenAPI
- **Import** an OpenAPI spec into ZIO HTTP
- **Create typed endpoints** from an existing API definition
- **Auto-generate** Scala code from OpenAPI

## Step 1: Add zio-http-gen Dependency

Add to `build.sbt`:

```scala
libraryDependencies += "dev.zio" %% "zio-http-gen" % "3.3.2"
```

---

## Step 2: Set Up a Code Generation Script

Create `scripts/generateFromOpenAPI.scala` or add to your build:

A complete worked example using the Pet Store OpenAPI 3.0 spec is in
[`references/examples/petstore.json`](references/examples/petstore.json) — load that file when you need a realistic spec to demonstrate generation. The Scala generator program looks like:

```scala
import zio._
import zio.http.endpoint.openapi._
import zio.http.gen.openapi._
import zio.http.gen.scala._

import java.nio.file.{Files, Paths}

object GenerateEndpointsFromOpenAPI extends ZIOAppDefault {
  def run = {
    // Read the OpenAPI spec from disk (see references/examples/petstore.json
    // for a complete worked example):
    val openAPIJsonString = new String(
      Files.readAllBytes(Paths.get("openapi-spec.json")),
      java.nio.charset.StandardCharsets.UTF_8
    )

    val program = for {
      // Parse the OpenAPI spec
      openAPI <- ZIO.fromEither(OpenAPI.fromJson(openAPIJsonString))
        .mapError(e => new Exception(s"Failed to parse OpenAPI: $e"))

      // Generate Scala code
      codeFiles <- ZIO.attempt {
        EndpointGen.fromOpenAPI(
          openAPI,
          Config(
            packageName = "com.example.api",
            objectName = "Endpoints",
            fieldNamesNormalization = true,
            generateSafeTypeAliases = true
          )
        )
      }

      // Write generated files to disk
      _ <- ZIO.attempt {
        CodeGen.writeFiles(
          codeFiles,
          basePath = "src/main/scala",
          basePackage = "com.example.api",
          scalafmtPath = None  // Set to Some("/path/to/scalafmt") to auto-format
        )
      }

      _ <- Console.printLine("✓ Generated Endpoint declarations in src/main/scala/com/example/api/")
    } yield ()

    program
  }
}
```

Run with:
```bash
sbt "runMain GenerateEndpointsFromOpenAPI"
```

---

## Step 3: Generated Code

After running the code generator, you'll get generated files like:

**`src/main/scala/com/example/api/Endpoints.scala`**

```scala
package com.example.api

import zio._
import zio.http._
import zio.http.endpoint._

object Endpoints {
  val listPets = Endpoint(Method.GET / "api" / "v1" / "pets")
    .query(HttpCodec.query[Int]("limit").optional)
    .out[Chunk[Pet]](status = Status.Ok)

  val createPet = Endpoint(Method.POST / "api" / "v1" / "pets")
    .in[Pet]
    .out[Pet](status = Status.Created)
}

case class Pet(
  id: Long,
  name: String,
  status: Option[String] = None
)
```

---

## Step 4: Implement the Endpoints

Now bind handlers to your generated endpoints:

```scala
import zio._
import zio.http._
import com.example.api.Endpoints._
import com.example.api.Pet

object MyAPI extends ZIOAppDefault {
  // Implement the endpoints
  val routes = Routes(
    listPets.implement { limit =>
      ZIO.succeed(Chunk(
        Pet(1, "Fluffy", Some("available")),
        Pet(2, "Spot", Some("sold"))
      ))
    },
    createPet.implement { pet =>
      ZIO.succeed(pet.copy(id = 999))
    }
  )

  def run = Server.serve(routes).provide(Server.default)
}
```

---

## Configuration Options

The `Config` object controls code generation behavior:

```scala
Config(
  packageName = "com.example.api",           // Generated package
  objectName = "Endpoints",                  // Top-level object name
  fieldNamesNormalization = true,            // Auto-convert snake_case to camelCase
  generateSafeTypeAliases = true,            // Create type aliases for simple types
  stringFormatTypes = Map(
    "uuid" -> "java.util.UUID",
    "date" -> "java.time.LocalDate",
    "date-time" -> "java.time.ZonedDateTime"
  )
)
```

---

## Loading OpenAPI from File

Instead of embedding JSON, load from a file:

```scala
import java.nio.file.Files
import java.nio.file.Paths

val openAPIJson = Files.readString(Paths.get("specs/openapi.json"))
val openAPI = OpenAPI.fromJson(openAPIJson) match {
  case Right(spec) => spec
  case Left(error) => throw new Exception(s"Parse error: $error")
}
```

Or load from a URL:

```scala
import sttp.client3._

val backend = HttpURLConnectionBackend()
val response = basicRequest
  .get(uri"https://api.example.com/openapi.json")
  .send(backend)

val openAPIJson = response.body.getOrElse("")
```

---

## Key Types

- **`OpenAPI`** — The parsed OpenAPI 3.0 document
- **`EndpointGen`** — Code generator that converts OpenAPI → Endpoint AST
- **`Config`** — Configuration for the code generator (package, naming, type mappings)
- **`Code.Files`** — Generated Scala code as an AST (before writing to disk)
- **`CodeGen.writeFiles`** — Writes `Code.Files` to disk with optional formatting

---

## Common Failures

| Symptom                                                              | Likely cause                                                                            | Fix                                                                                                                          |
|----------------------------------------------------------------------|-----------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------|
| `Failed to parse OpenAPI`                                            | Invalid JSON/YAML, or unsupported OpenAPI dialect.                                      | Validate at https://editor.swagger.io. Confirm the spec is OpenAPI 3.0/3.1 (Swagger 2.0 is not supported by `zio-http-gen`). |
| `Field type not found`                                               | Spec references a schema (`$ref`) that isn't defined under `#/components/schemas/`.    | Add the missing schema to `components.schemas`, or fix the broken `$ref` path.                                               |
| Generated code doesn't compile                                       | `zio-http` and/or `zio-schema` missing from `build.sbt`, or version mismatch.           | Add both deps with the same major version. Run `sbt evicted` to confirm no conflicting transitive versions.                  |
| Generated code compiles but field names look wrong (`personId` etc.) | `fieldNamesNormalization = true` is rewriting from the spec's `person_id`.              | Either accept the normalization (idiomatic Scala) or set `fieldNamesNormalization = false` to keep spec field names.         |
| Custom string formats produce `String` instead of a typed value      | The format isn't registered in `Config.stringFormatTypes`.                              | Add the mapping: `Config(..., stringFormatTypes = Map("uuid" -> "java.util.UUID", ...))`.                                    |
| Circular `$ref` chains cause non-termination                          | Self-referential schemas without recursion limits.                                      | Restructure the spec to use `oneOf` / `anyOf` at the recursion boundary, or split into multiple smaller schemas.             |

---

## Next Steps

- **Add Swagger UI** — Use the generated endpoints to auto-generate Swagger docs (see `zio-http-endpoint-to-openapi`)
- **Type-safe client** — Use `EndpointExecutor` to call endpoints with full type checking
- **Custom auth** — Add authentication logic to endpoints
- **Error handling** — Map business errors to HTTP status codes

---

## References

- [zio-http-gen GitHub](https://github.com/zio/zio-http/tree/main/zio-http-gen)
- [EndpointGen API](https://github.com/zio/zio-http/blob/main/zio-http-gen/src/main/scala/zio/http/gen/openapi/EndpointGen.scala)
- [GenerateEndpointFromOpenAPIExample.scala](https://github.com/zio/zio-http/blob/main/zio-http-example/src/main/scala/example/endpoint/GenerateEndpointFromOpenAPIExample.scala)
- [OpenAPI 3.0 Spec](https://spec.openapis.org/oas/v3.0.3)
