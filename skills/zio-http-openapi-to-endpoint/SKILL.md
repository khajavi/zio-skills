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

```scala
import zio._
import zio.http.endpoint.openapi._
import zio.http.gen.openapi._
import zio.http.gen.scala._

object GenerateEndpointsFromOpenAPI extends ZIOAppDefault {
  def run = {
    val openAPIJsonString = """
    {
      "openapi": "3.0.0",
      "info": {"title": "Pet Store API", "version": "1.0.0"},
      "paths": {
        "/api/v1/pets": {
          "get": {
            "operationId": "listPets",
            "parameters": [
              {"name": "limit", "in": "query", "schema": {"type": "integer"}}
            ],
            "responses": {
              "200": {
                "description": "A list of pets",
                "content": {
                  "application/json": {
                    "schema": {"type": "array", "items": {"$ref": "#/components/schemas/Pet"}}
                  }
                }
              }
            }
          },
          "post": {
            "operationId": "createPet",
            "requestBody": {
              "required": true,
              "content": {
                "application/json": {"schema": {"$ref": "#/components/schemas/Pet"}}
              }
            },
            "responses": {
              "201": {
                "description": "Pet created",
                "content": {
                  "application/json": {"schema": {"$ref": "#/components/schemas/Pet"}}
                }
              }
            }
          }
        }
      },
      "components": {
        "schemas": {
          "Pet": {
            "type": "object",
            "required": ["id", "name"],
            "properties": {
              "id": {"type": "integer", "format": "int64"},
              "name": {"type": "string"},
              "status": {"type": "string", "enum": ["available", "pending", "sold"]}
            }
          }
        }
      }
    }
    """

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

## Troubleshooting

**"Failed to parse OpenAPI"**
- Ensure your JSON/YAML is valid. Use [swagger.io/tools/swagger-editor](https://editor.swagger.io) to validate.

**"Field type not found"**
- The OpenAPI spec references a schema that doesn't exist. Check `#/components/schemas/` definitions.

**"Generated code doesn't compile"**
- Ensure `zio-http` and `zio-schema` are in your classpath.
- If using custom formats, add them to the `stringFormatTypes` map in `Config`.

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
