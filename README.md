# ZIO Skills — Teach Your Agent to Build ZIO Applications

Teaching coding agents (Claude Code, Cursor, Codex, Gemini, OpenCode) how to build and document ZIO applications.

This marketplace currently ships three plugins:

- **`zio-skills`** — Build ZIO and ZIO HTTP applications (server scaffolding, OpenAPI code generation, endpoint API, …).
- **`documentation`** — Write high-quality documentation for ZIO libraries (reference pages, how-to guides, tutorials, mdoc conventions, writing-style enforcement).
- **`docs-write`** — Guided documentation authoring workflow (research, generation, and quality review for existing code).

## Installation

### Claude Code

First, add the marketplace, then install one or both plugins:

```bash
claude plugin marketplace add zio/zio-skills

# build apps with ZIO / ZIO HTTP
claude plugin install zio-skills@ziogenetics

# write documentation for ZIO libraries
claude plugin install documentation@ziogenetics

# guided documentation authoring workflow
claude plugin install docs-write@ziogenetics
```

Then invoke a skill in Claude Code:
```
/zio-http-scaffold
/zio-http-openapi-to-endpoint
/zio-http-endpoint-to-openapi
/zio-http-imperative-to-declarative
/docs-write
/docs-data-type-ref
/docs-how-to-guide
/docs-tutorial
/docs-writing-style
```

### Cursor

```bash
/add-plugin zio-skills
```

### Gemini CLI

```bash
gemini extensions install https://github.com/zio/zio-skills
```

To update:

```bash
gemini extensions update zio-skills
```

### Codex

Clone the repo and symlink:

```bash
git clone https://github.com/zio/zio-skills.git ~/.agents/skills/zio-skills
```

or user Skill Installer inside codex cli:

```bash
$skill-installer zio/zio-skills
```

### OpenCode

Add to `opencode.json`:
```json
{
  "plugin": ["zio-skills@git://github.com/zio/zio-skills.git"]
}
```

## Skills

### ZIO HTTP (`zio-skills` plugin)

- **`zio-http-scaffold`** — Scaffold a minimal ZIO HTTP server and client
- **`zio-http-openapi-to-endpoint`** — Generate Endpoint declarations from an OpenAPI spec
- **`zio-http-endpoint-to-openapi`** — Generate OpenAPI documentation from Endpoint declarations + serve Swagger UI
- **`zio-http-imperative-to-declarative`** — Convert imperative routes to typed Endpoint API

### Documentation (`documentation` plugin)

Orchestration:
- **`docs-write`** — Guided 5-phase workflow for writing documentation (research, generation, quality review)

Authoring skills:
- **`docs-data-type-ref`** — Write a reference page for a single data type
- **`docs-module-ref`** — Write a reference page for a module (multiple related types)
- **`docs-how-to-guide`** — Write a goal-oriented how-to guide
- **`docs-tutorial`** — Write a learning-oriented tutorial for newcomers
- **`docs-document-pr`** — Generate documentation from a GitHub PR
- **`docs-add-missing-section`** — Add a missing section to an existing reference page
- **`docs-enrich-section`** — Add motivation and use-cases to a thin section

Authoring helpers:
- **`docs-examples`** — Shared procedure for creating runnable companion examples
- **`docs-research`** — Shared research procedure (find source, tests, examples, history)
- **`docs-integrate`** — Wire a new doc page into Docusaurus navigation
- **`docs-organize-types`** — Group types into logical sidebar categories

Quality checks:
- **`docs-writing-style`** — Prose style rules with mechanical validation script
- **`docs-mdoc-conventions`** — mdoc code-block modifiers and Docusaurus admonitions
- **`docs-check-compliance`** — Audit a doc file against a rule skill
- **`docs-verify-compliance`** — Fix compliance issues in a doc file
- **`docs-critique`** — Review and fix an existing documentation file using a maker-critic loop
- **`docs-find-documentation-gaps`** — Scan project for undocumented types/modules
- **`docs-report-method-coverage`** — Check that all public members are documented
- **`docs-data-type-list-members`** — Extract public members from a Scala type
- **`docs-skill-retrospection`** — Improve a docs-* skill from execution feedback

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
