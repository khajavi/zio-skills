## Writing Flue Agents
Read https://flueframework.com/start.md then help create flue agents

## Never commit anything under fixtures/tinyoptics/ or fixtures/tinytally/

Each fixture is a from-scratch baseline: sparse starter docs, no generated examples,
a clean `build.sbt`. Every run is measured against it, so committing a run's output
destroys it — later runs stop exercising the empty-start path, and quality can no
longer be judged against a known baseline.

A run writes far more than docs. All of it is output, none of it is committed:

- `docs/` — pages, `index.md`, `sidebars.js`
- `examples/` and `<fixture>-examples/` — generated `.scala`, `project/build.properties`
- `build.sbt` — the integrate phase edits it (`mdocVariables`, subprojects)
- `website/docs/` and `website/build/` — mdoc output and the Docusaurus build

✅ `bash scripts/archive-docs.sh <log> <label>` — snapshots the whole run to
`fixtures/<fixture>-archive/<label>-turn<N>/` and resets the fixture
❌ `git add -A` after a run — sweeps generated pages, examples and build edits into
whatever you commit next

Treat both fixture directories as read-only from git's point of view. Archive first,
then stage source paths explicitly (`git add src/ README.md`). Never `git add -A`
while run output is in the working tree — it has already caused two history rewrites.

## Which fixture to run

`tinytally` (2 types × 3 methods) for everything that does not need scale: verifying a
fix, checking a phase's behaviour, reproducing a defect. Its API names are invented, so a
model that fabricates instead of reading produces something visibly wrong.

`tinyoptics` (4 types × ~6 methods) when the finding depends on size — cost curves,
context bloat, how a long module run degrades. It cost $3.30 for one module run.

Build the site with `npm run build`, never `pnpm build`: this repo is a pnpm workspace, so
`pnpm run` auto-installs against the outer workspace and dies before Docusaurus starts.

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
