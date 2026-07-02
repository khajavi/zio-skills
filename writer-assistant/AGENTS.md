## Structure

```
agents/    → Claude agent profiles
workflows/ → Orchestrators
lib/       → Pure utilities (testable)
tools/     → Flue tools (I/O only)
skills/    → SKILL.md (LLM instructions)
tests/     → Vitest tests
```

## Running Workflows

```bash
npm run build
export ANTHROPIC_API_KEY=$(grep ANTHROPIC_API_KEY .env | cut -d= -f2)
npx flue run crossref --target node --input '{...}'
```

## Formatting

Run `npx prettier --write <file>` after every edit. CI enforces it.

## Testing

```bash
npm test      # Run all
npm test:watch
```

Tests pass before commit.

## Git

- One commit per logical change
- Message: `type: description`
- Types: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
- No force-push
- Tests pass first

## Documentation Maintenance

After any significant change, update `README.md` (feature list + quick-start example) and `ARCHITECTURE.md` (directory tree + workflow section). Same commit or immediate `docs:` follow-up.

After developing a new workflow or agent, update `AGENT_RUNNING_GUIDE.md` with the new workflow's payload schema and usage example.

## Flue Framework Reference

Flue docs ship with the npm packages. Read them directly — do not rely on training data for Flue API signatures.

- `node_modules/@flue/runtime/docs` — core API: `defineAgent`, `defineWorkflow`, tools, skills, sandboxes, subagents
- `node_modules/@flue/cli/docs` — CLI usage: `flue run`, `flue docs`, deploy targets
- `node_modules/@flue/sdk/docs` — SDK: channels, evals, observability, schedules

Alternatively you can use `flue docs` to get/search documentation pages of flue project:

```
flue docs                  List all documentation pages
flue docs read <path>      Print a documentation page as markdown
flue docs search <query>   Search the documentation (JSON results)
```
