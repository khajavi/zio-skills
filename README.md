# ZIO Skills — Developer Skills for Coding Agents

Teaching coding agents (Claude Code, Cursor, Codex, Gemini, OpenCode) how to build production-grade ZIO applications.

## Installation

### Claude Code
```bash
claude plugin install khajavi/zio-skills
```

Then invoke a skill in Claude Code:
```
/skill zio-http-scaffold
/skill zio-http-openapi-to-endpoint
/skill zio-http-endpoint-to-openapi
/skill zio-http-imperative-to-declarative
```

### Cursor
```bash
cursor plugin install khajavi/zio-skills
```

Skills auto-load in Cursor's agent context.

### Gemini CLI
Add to your Gemini config or project `.gemini` file:
```
@plugin khajavi/zio-skills/GEMINI.md
```

### Codex
Clone the repo and symlink:
```bash
git clone https://github.com/khajavi/zio-skills.git ~/.agents/skills/zio-skills
```

### OpenCode
Add to `opencode.json`:
```json
{
  "plugin": ["zio-skills@git+https://github.com/khajavi/zio-skills.git"]
}
```

## Skills

### ZIO HTTP

- **`zio-http-scaffold`** — Scaffold a minimal ZIO HTTP server and client
- **`zio-http-openapi-to-endpoint`** — Generate Endpoint declarations from an OpenAPI spec
- **`zio-http-endpoint-to-openapi`** — Generate OpenAPI documentation from Endpoint declarations + serve Swagger UI
- **`zio-http-imperative-to-declarative`** — Convert imperative routes to typed Endpoint API

## Planned Skills

- Typed path & query parameters
- Custom middleware with context injection
- Type-safe HTTP client with EndpointExecutor
- Server-Sent Events (SSE) streaming
- WebSocket handlers
- Datastar reactive UI integration
- HTML templates with template2 DSL
- Multipart form uploads
- Testing with zio-http-testkit
- Metrics & Prometheus integration
- ZIO Streams patterns
- ZIO Config patterns
- And more…

## Contributing

Skills are curated learning resources. See [CLAUDE.md](CLAUDE.md) for contribution guidelines.

## License

MIT
