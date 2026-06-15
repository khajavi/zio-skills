---
providers:
  anthropic:
    apiKey: ${ANTHROPIC_API_KEY}
---

# Development Rules

## Code

- TypeScript strict mode
- `const`/`let` only, no `var`
- camelCase variables, snake_case files
- Named exports only
- No `any`, no comments unless WHY non-obvious

## Structure

```
agents/    → Claude agent profiles
workflows/ → Orchestrators
lib/       → Pure utilities (testable)
tools/     → Flue tools (I/O only)
skills/    → SKILL.md (LLM instructions)
tests/     → Vitest tests
```

## Imports

```typescript
import fs from 'node:fs';
import { func } from '../lib/module.js';
```

Node modules use `node:`. Named exports only.

## Functions

- Pure in `lib/` — no I/O
- Immutable — return new objects
- Explicit types
- Throw on error (don't return null)
- One responsibility

## State

- Load → Process → Save (atomic)
- Never mutate state
- Validate with Valibot
- Stored in `.crossref-state/`

## Paths

- Always `realpathSync()` symlinks
- Check resolved path within boundary
- Never trust user paths

## Logging

```
[workflow-name] ✓ Processed: Title (1/42) | Applied: 3
[workflow-name] Error: ...
```

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

## Agents

- Skill-driven (behavior in `skills/*/SKILL.md`)
- Minimal tools
- Validate LLM output before use

## Markdown

- Protect code blocks, inline code, frontmatter
- Safe phrase matching (word boundaries)
- Preserve original casing

## Security

- Validate all paths (symlink + boundary)
- Never hardcode secrets
- Never execute LLM output
- Escape shell arguments
