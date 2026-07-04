## Writing Flue Agents
Read https://flueframework.com/start.md then help create flue agents

## Autonomous Agent Best Practices

### 1. Set the stage, don't script the steps
Give goal + capable environment + loop. Don't hardcode do-this-then-that. Model finds path: read → act → observe → correct → repeat. Hardcoded steps = brittle, break when reality diverges.

### 2. Build context, not code
Agent quality ≈ quality of model, instructions, tools, skills, environment. Spend effort there.

An agent is model + instructions + tools + skills + sandbox. Building one is less about code, more about the context you assemble:

```ts
// .flue/agents/triage.ts
import { defineAgent } from '@flue/runtime';
import { local } from '@flue/runtime/node';

export default defineAgent(() => ({
  model: 'anthropic/claude-sonnet-4-6',
  instructions, // who the agent is
  tools,        // what it can do
  skills,       // expertise loaded on demand
  sandbox: local(), // where it runs, safely
}));
```

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
