# ZIO Skills — Teach Your Agent to Build ZIO Applications

Teaching coding agents (Claude Code, Cursor, Codex, Gemini, OpenCode) how to build ZIO applications.

## Installation

### Claude Code

First, add the plugin to your marketplace and then install it from the marketplace:

```bash
claude plugin marketplace add khajavi/zio-skills
claude plugin install zio-skills@zio-skills-dev
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
cursor plugin install khajavi/zio-skills
```

Skills auto-load in Cursor's agent context.

### Gemini CLI

```
gemini extensions install https://github.com/khajavi/zio-skills
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

## Uninstallation

### Claude Code

If installed from GitHub marketplace:
```bash
claude plugin uninstall khajavi/zio-skills
```

If installed locally from a marketplace:
```bash
claude plugin uninstall zio-skills@<marketplace-name>
```

For example, if installed from local path:
```bash
claude plugin uninstall zio-skills@zio-skills-dev
```

Or manually remove from `~/.claude/settings.json`:
```bash
# Edit ~/.claude/settings.json and remove the zio-skills plugin entry
```

### Cursor
```bash
cursor plugin uninstall khajavi/zio-skills
```

### Gemini CLI
Remove the `@plugin` directive from your `.gemini` file or Gemini config:
```bash
# Remove or comment out this line:
# @plugin khajavi/zio-skills/GEMINI.md
```

### Codex
```bash
rm -rf ~/.agents/skills/zio-skills
```

### OpenCode
Remove from `opencode.json`:
```bash
# Edit opencode.json and remove the zio-skills plugin entry
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
