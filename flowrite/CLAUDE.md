## Writing Flue Agents
Read https://flueframework.com/start.md then help create flue agents

## Never commit tinyoptics documentation

`fixtures/tinyoptics/docs/` is deliberately sparse — a handful of small starter
files that give a documentation agent somewhere to write. It is the from-scratch
baseline every run is measured against, so committing a run's output destroys the
fixture: later runs no longer exercise the empty-start path, and quality can no
longer be judged against a known baseline.

✅ `bash scripts/archive-docs.sh <log> <label>` — snapshots the run to
`fixtures/tinyoptics-archive/<label>-turn<N>/` and resets the fixture
❌ `git add -A` after a run — sweeps generated pages into whatever you commit next

Never stage anything under `fixtures/tinyoptics/docs/`. Stage source paths
explicitly (`git add src/ README.md`) rather than using `git add -A` while a run's
output is in the working tree.

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

Always prefer declarative context over imperative code. The model + instructions + tools + skills + sandbox is the agent's "mind". The code is just a wrapper.

### 3. Nudge by example, not explanation
When adding a rule to a skill/profile, show it as a compact ✅/❌ pair, not a prose paragraph — examples teach the boundary faster and cost fewer tokens.

✅ `Family header: \`#### Accessors\` (members in prose), not \`#### getInt / getLong / … — Read a field\``
❌ `When a subsection documents a family of related methods, avoid enumerating every method name in the header because it becomes long; instead use a short group label and list the members in the introductory prose.`

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
