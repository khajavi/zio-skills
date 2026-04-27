# ZIO Skills — Teach Your Agent to Build ZIO Applications

Teaching coding agents (Claude Code, Cursor, Codex, Gemini, OpenCode) how to build ZIO applications.

## Installation

### Claude Code

First, add the plugin to your marketplace and then install it from the marketplace:

```bash
claude plugin marketplace add khajavi/zio-skills
claude plugin install zio-skills@ziogenetics
```

Then invoke a skill in Claude Code:
```
/zio-http-scaffold
/zio-http-openapi-to-endpoint
/zio-http-endpoint-to-openapi
/zio-http-imperative-to-declarative
```

### Cursor

```bash
/add-plugin zio-skills
```

### Gemini CLI

```bash
gemini extensions install https://github.com/khajavi/zio-skills
```

To update:

```bash
gemini extensions update zio-skills
```

### Codex

Clone the repo and symlink:

```bash
git clone https://github.com/khajavi/zio-skills.git ~/.agents/skills/zio-skills
```

or user Skill Installer inside codex cli:

```bash
$skill-installer khajavi/zio-skills
```

### OpenCode

Add to `opencode.json`:
```json
{
  "plugin": ["zio-skills@git://github.com/khajavi/zio-skills.git"]
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

[License](LICENSE)
