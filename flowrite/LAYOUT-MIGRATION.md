# Making flowrite's layout idiomatic Flue

*Written for someone who has not worked on flowrite or Flue before. Concepts first, then the target
shape, then one commit at a time with the exact commands, what to check, and how to undo it.*

Every claim about Flue here is quoted from the docs that ship inside the repo. Read them yourself:

```bash
./node_modules/.bin/flue docs read guide/project-layout
./node_modules/.bin/flue docs read guide/routing
./node_modules/.bin/flue docs read guide/database
```

`pnpm exec flue` does not work in this repo — always `./node_modules/.bin/flue`.

---

## 0. Five concepts you need first

**Source directory.** The one folder Flue reads your code from. It is chosen by a fixed search, not
configured:

> "Flue selects one source directory in this order: 1. `.flue/` 2. `src/` **(Recommended)** 3. the
> project root. The first matching directory wins. **Flue does not merge layouts.**"
> — `guide/project-layout`

flowrite uses `src/`, which is the recommended one. Nothing in this plan changes that, and that is
why the whole migration is *inside* `src/`.

**The `'use agent'` scan.** A module whose first line is `'use agent'` is an agent. Flue finds these
by scanning the source directory, so an agent module can sit anywhere under `src/` — `src/agent.ts`
and `src/agents/docs-writer.ts` are equally findable. flowrite has exactly one:
`src/agents/docs-writer.ts`.

**`app.ts` — the route map.** Registering an agent makes it *addressable*; serving it over HTTP is a
separate decision you write down:

> "Flue never mounts an agent automatically… if a route exists, `app.ts` put it there."
> — `guide/routing`

flowrite has no `app.ts` today, which is why `vite build` fails and why the only way to run it is
`flue run <path>`.

**Persistence adapter (`db.ts`).** Where Flue stores *its own* durable state — conversation streams,
accepted submissions, attachments. Not application data:

> "A Flue database stores the runtime's own durable state — **not your application's business data**."
> — `guide/database`

Without a `db.ts`, `flue run` writes to `node_modules/.cache/flue/run.db`. That is a cache directory:
`pnpm install --force`, a dependency bump, or a cleanup wipes every past conversation.

**The Vite plugin.** Flue's dev server and production build are Vite's, via `flue()` from
`@flue/vite` in `vite.config.ts`. flowrite has neither the config nor the package, so `vite dev` and
`vite build` do not work at all today (`vite build` currently dies with `Cannot resolve entry module
index.html`, because with no Flue plugin Vite falls back to treating the project as a web app).

---

## 1. Where we are, and where this ends up

```
NOW                                    AFTER
src/                                   src/
├─ agents/                             ├─ app.ts            ← new: the route map
│  ├─ docs-writer.ts        the agent  ├─ db.ts             ← new: durable conversations
│  ├─ docs-writer.test.ts              ├─ agent.ts          ← was agents/docs-writer.ts
│  ├─ data-type-ref-writer.md          ├─ agent.test.ts
│  ├─ module-ref-writer.md             ├─ instructions/     ← the three .md kind files
│  └─ tutorial-writer.md               │  ├─ data-type-ref.md
├─ phases/          8 harness tools    │  ├─ module-ref.md
│  ├─ research.ts                      │  └─ tutorial.md
│  ├─ design-doc-structure.ts          ├─ tools/
│  ├─ write-doc.ts                     │  ├─ phases/        ← was src/phases/
│  ├─ review-page.ts                   │  │  ├─ research.ts
│  ├─ integrate.ts                     │  │  └─ … 7 more
│  └─ … 3 more                         │  ├─ check-method-coverage.ts
├─ tools/           3 files            │  ├─ repo-tools.ts
├─ subagents/       9 .ts + 9 .md      │  └─ todo-tools.ts
├─ skills/          8 skill dirs       ├─ subagents/        unchanged
└─ shared/          18 files           ├─ skills/           unchanged
                                       └─ runtime/          ← was shared/
                                          ├─ composition.ts ← was shared/docs-writer.ts
                                          └─ … the rest

vite.config.ts       ← new
package.json         ← new deps: vite, @flue/vite, hono; new scripts: dev, build
```

### Why each move

| Move | Reason |
|---|---|
| `phases/` → `tools/phases/` | Every file in it is `defineTool({harness: true})`. They *are* tools. Flue has no "phase" concept, so a `phases/` folder sitting next to `tools/` reads to any Flue reader as a second, undocumented tool system. Nesting keeps flowrite's own grouping while using Flue's vocabulary. |
| `shared/` → `runtime/` | `shared/` is not in either example layout (the guide shows `src/agents/shared/`, and only for multi-agent projects). The name also invites rot: three modules were removed from it today (`frontmatter.ts`, `schemas.ts`, `author-hint.ts`) for the same reason — each said "shared by every X" in its docstring after X had stopped existing. `runtime/` describes what the files *are* (the run's own scaffolding: observability, context, delegation, cache) rather than a claim about how many callers they have. |
| `shared/docs-writer.ts` → `runtime/composition.ts` | It currently shares a filename with `agents/docs-writer.ts`. One is the agent; the other is the hook that composes it. Two editor tabs, same label. |
| `agents/docs-writer.ts` → `agent.ts` | The guide's single-agent example is `src/agent.ts` with flat `tools/ skills/ subagents/`. flowrite has one agent, so `agents/` is a multi-agent folder holding one file — and it isn't even the multi-agent *shape* (that would be `agents/docs-writer/{agent.ts,tools/,…}`). |
| the three `.md` files → `instructions/` | They are the per-kind identity text the `KINDS` table imports, not agent modules. At `src/agents/*.md` they look like three agents to a newcomer. |
| add `app.ts` | Makes the writer addressable over HTTP, which is what unlocks channels, schedules and the SDK later. |
| add `db.ts` | Moves conversation history out of `node_modules/.cache/`, where any install can delete it. |
| add `vite.config.ts` + deps | `vite dev` and `vite build` do not currently work. |

---

## 2. Decisions already taken — do not re-open

1. **Flat single-agent layout**, not the nested multi-agent one. A second agent (docs-gardener,
   zio-newsletter) means one restructure later; that is cheaper than carrying nesting for one agent
   now.
2. **Full application shape**: `app.ts`, `vite.config.ts` and `db.ts` all get added.
3. **`src/` stays the source directory.** `.flue/` is for embedding Flue inside a larger app.
4. **The archived fixture runs are frozen.** `fixtures/tinyoptics-archive/**` contains ~60 copies of
   the old run scripts. They are historical records (and git-ignored) — they are not edited.

---

## 3. The commits

Five steps, each one commit, each independently revertible. Order is deliberate: the cheap moves
with a two-file blast radius come first, and the step that can break a real run comes last but one.

Run this after **every** step:

```bash
cd /home/milad/sources/zio-skills/flowrite
./node_modules/.bin/tsc --noEmit
pnpm --config.verify-deps-before-run=false test        # expect 39 passing
```

And this probe, which is the cheapest proof the agent still assembles (it catches a broken import
chain or a lost tool that tsc will not):

```bash
node --import ./test-setup/md-imports.mjs -e "
import('./src/agent.ts').then(m => {          # ./src/agents/docs-writer.ts before step 3
  for (const [kind, cfg] of Object.entries(m.KINDS))
    console.log(kind.padEnd(10), cfg.tools.map(t => t.name).join(', '));
});"
```

Expected output, unchanged by every step in this plan:

```
data-type  research_data_type, design_data_type_structure, write_data_type_reference, write_companion_examples, integrate_data_type_reference, review_data_type_ref
module     research_module, design_module_structure, write_module_overview, research_data_type, write_data_type_reference, write_companion_examples, integrate_module_reference, review_module_ref
tutorial   research_tutorial_topic, design_tutorial_structure, write_tutorial_draft, write_companion_examples, integrate_tutorial, review_tutorial
```

### Step 1 — `phases/` becomes `tools/phases/`

Blast radius is two files: only `src/agents/docs-writer.ts` and `src/shared/component-usage.ts`
import from `phases/`.

```bash
mkdir -p src/tools/phases
git mv src/phases/*.ts src/tools/phases/
rmdir src/phases

# importers: agents/ and shared/ are both one level from src/, so '../phases/' → '../tools/phases/'
sed -i "s#\.\./phases/#../tools/phases/#g" src/agents/docs-writer.ts src/shared/component-usage.ts
# inside the moved files, siblings stay './x.ts' but shared/ and skills/ gained one level
sed -i "s#\.\./shared/#../../shared/#g; s#\.\./skills/#../../skills/#g" src/tools/phases/*.ts
```

Verify, then commit as `refactor(layout): phase tools live under tools/`.

**Rollback:** `git revert <sha>`. Nothing outside these files changes.

### Step 2 — `shared/` becomes `runtime/`, and the duplicate name goes

```bash
git mv src/shared src/runtime
git mv src/runtime/docs-writer.ts src/runtime/composition.ts

# 19 files import from shared/
grep -rl "shared/" src/ | xargs sed -i "s#/shared/#/runtime/#g"
grep -rl "runtime/docs-writer.ts" src/ | xargs sed -i "s#runtime/docs-writer\.ts#runtime/composition.ts#g"
```

Then rewrite the header docstring of `composition.ts` to say what it is — the shared composition for
the writing branch — rather than repeating the agent's name.

Verify, then commit as `refactor(layout): shared/ becomes runtime/; composition gets its own name`.

**Rollback:** `git revert <sha>`. Pure renames.

### Step 3 — the agent moves to `src/agent.ts`

This is the step that can break a real run, because three live shell scripts name the old path.

```bash
git mv src/agents/docs-writer.ts src/agent.ts
git mv src/agents/docs-writer.test.ts src/agent.test.ts
mkdir -p src/instructions
git mv src/agents/data-type-ref-writer.md src/instructions/data-type-ref.md
git mv src/agents/module-ref-writer.md    src/instructions/module-ref.md
git mv src/agents/tutorial-writer.md      src/instructions/tutorial.md
rmdir src/agents

# src/agent.ts is now one level shallower: '../x/' → './x/'
sed -i "s#'\.\./#'./#g" src/agent.ts
# and its three instruction imports moved
sed -i "s#'\./data-type-ref-writer\.md'#'./instructions/data-type-ref.md'#; \
        s#'\./module-ref-writer\.md'#'./instructions/module-ref.md'#; \
        s#'\./tutorial-writer\.md'#'./instructions/tutorial.md'#" src/agent.ts
sed -i "s#\.\./agents/docs-writer\.ts#../agent.ts#g" src/agent.test.ts

# the three LIVE run scripts (never the archive copies)
sed -i "s#src/agents/docs-writer\.ts#src/agent.ts#g" fixtures/tinyoptics/scripts/run-*.sh
# and the two docs that quote the command
sed -i "s#src/agents/docs-writer\.ts#src/agent.ts#g" README.md MIGRATION-2.x.md
```

Check the sed on `src/agent.ts` by eye — `'../` → `'./` is broad, and the file also contains
`'use agent'` and prose. `git diff src/agent.ts` before committing.

Verify with the probe above (now importing `./src/agent.ts`), **then one real fixture run** — this is
the only check that proves the run scripts still work:

```bash
bash fixtures/tinyoptics/scripts/run-data-type-ref.sh "Prism"
```

Runs use haiku via `--env .env.testing`, which the script already passes. **Print the log path it
reports.** Afterwards, archive rather than committing the output:

```bash
bash fixtures/tinyoptics/scripts/archive-docs.sh <log-path> write-data-type-ref
```

> **Never `git add -A` while a run's output is in the working tree.** A run writes `docs/`,
> `examples/` and `build.sbt` edits into `fixtures/tinyoptics/`; sweeping those in has already caused
> two history rewrites. Archive first, then stage explicit paths.

Commit as `refactor(layout)!: the agent is src/agent.ts`.

**Rollback:** `git revert <sha>` restores both the module paths and the run scripts together, which
is why they are one commit — a revert that fixed the code and left the scripts pointing at a deleted
file would be worse than the bug.

### Step 4 — `src/db.ts`

```ts title="src/db.ts"
import { sqlite } from '@flue/runtime/node';

/**
 * Conversation storage for flowrite's own runs.
 *
 * Without this file, `flue run` writes to node_modules/.cache/flue/run.db — a cache directory, so any
 * `pnpm install --force` or dependency bump silently discards every past run's conversation. This
 * moves it somewhere a cleanup will not reach.
 *
 * The path is relative to the process working directory, which for every flowrite run is the
 * flowrite root: fixtures/tinyoptics/scripts/run-*.sh all `cd "$flowrite_root"` before exec'ing flue.
 *
 * NOT where the research cache lives. Flue's database holds the runtime's own state — conversation
 * streams, accepted submissions, attachments — and the guide is explicit that it is "not your
 * application's business data". The research cache owns its own SQLite file per documented checkout,
 * in src/runtime/research-cache.ts.
 */
export default sqlite('./data/flue.db');
```

```bash
printf 'data/\n' >> .gitignore
```

`sqlite()` needs no dependency — it runs on Node's built-in `node:sqlite`, and "creates the file (and
any missing parent directories) on first boot" (`guide/database`).

Verify by running the pipeline once more and confirming `data/flue.db` appears. Commit as
`feat(layout): durable conversation storage via db.ts`.

**Rollback:** `git revert <sha>`, then `rm -rf data/`. Reverting sends `flue run` back to the cache
file; conversations recorded in `data/flue.db` become unreachable, which costs nothing because the run
scripts pass no `--id` (every run is a fresh conversation — checked, not assumed).

### Step 5 — `app.ts`, `vite.config.ts`, and the build

```bash
pnpm add -D vite @flue/vite
```

**`hono` is not needed** — measured, after this plan first claimed otherwise. `createAgentRouter`
returns a `Hono`, and the first draft of this plan asserted that pnpm's strict isolation would stop
TypeScript resolving that type without a direct dependency. It does not: tsc resolves the type through
`@flue/runtime`'s own typings, and `tsc --noEmit --listFiles` confirms `src/app.ts` is really in the
program rather than being skipped. The evidence behind the wrong claim was a runtime `import('hono')`
from the project root, which is a different lookup and does fail. Add `hono` only if `app.ts` grows to
`new Hono()` for a second route.

```ts title="src/app.ts"
import { createAgentRouter } from '@flue/runtime/routing';
import { DocsWriter } from './agent.ts';

/**
 * The route map. Flue mounts nothing on its own — "if a route exists, app.ts put it there"
 * (guide/routing) — so this is the file that makes the writer reachable over HTTP.
 *
 * flowrite's own runs do not go through here: they are `flue run src/agent.ts`, which invokes the
 * agent directly. This exists so `vite build` produces a server, and so channels, schedules and the
 * SDK have something to talk to when they are wanted.
 */
export default createAgentRouter(DocsWriter);
```

```ts title="vite.config.ts"
import { defineConfig } from 'vite';
import { flue } from '@flue/vite';

export default defineConfig({
  plugins: [flue()],
});
```

Add the scripts:

```json
"scripts": {
  "dev": "vite dev",
  "build": "vite build",
  "test": "node --import ./test-setup/md-imports.mjs --test"
}
```

Verify: `pnpm build` must now succeed and write `dist/` (already git-ignored). If
`createAgentRouter(...)` alone is rejected as the default export, wrap it — the guide's own example
does this, and it is also where any extra route would go:

```ts
import { Hono } from 'hono';
const app = new Hono();
app.route('/agents/docs-writer', createAgentRouter(DocsWriter));
export default app;
```

Commit as `feat(layout): app.ts route map and the Vite build`.

**Rollback:** `git revert <sha>` and `pnpm install`. Nothing else depends on these files —
`flue run` never reads `app.ts`.

---

## 4. What could go wrong

| Risk | Why it is contained |
|---|---|
| A `sed` corrupts prose or a string, not just an import | `git diff` each step before committing; step 3's `'../` → `'./` is the one broad rewrite and needs an eyeball. |
| A run script keeps pointing at the deleted agent path | Step 3 moves the module and the three live scripts in one commit, so a revert restores both. |
| The archived fixture scripts still name the old path | They are frozen history and git-ignored. Leave them. |
| `db.ts` orphans conversation history | The run scripts pass no `--id`, so every run is a fresh conversation. Verified, not assumed. |
| `vite build` still fails | It fails *today*, so this step cannot regress anything. If the plugin needs more config, stop at step 4 — steps 1-4 stand alone. |
| A phase tool silently disappears from a kind | The `KINDS` probe prints the exact tool list; it must match the expected output above at every step. |

**Revert trigger, decided in advance:** if the step-3 fixture run does not produce a page, revert
step 3 immediately rather than debugging forward — the layout is cosmetic and the pipeline is not.

---

## 5. Deliberately not in this plan

- **The nested multi-agent layout.** Chosen against: one agent does not need
  `agents/docs-writer/{tools,skills,subagents}/`. Revisit when docs-gardener or zio-newsletter
  actually lands, and expect that to be its own restructure.
- **`.flue/` as the source directory.** For embedding Flue in a larger application. flowrite *is* the
  application.
- **Moving `fixtures/` or `scripts/`.** Neither is Flue's concern; the guide only governs `src/` and
  the four top-level entry files.
- **Splitting `runtime/` further** (e.g. `runtime/observability/`). It is 18 files in three coherent
  groups, which is legible; splitting again would be a second restructure for the same reader.
- **Renaming the emitted log lines or archived JSON filenames.** `run report:` →
  `run-report.json` is parsed by `archive-docs.sh` and read by `scripts/run-report.mjs` out of every
  historical turn. The module was renamed to `run-telemetry.ts`; the wire format stays.

## 6. One open choice

The directory for the three per-kind identity files. This plan uses `src/instructions/`. The option
you picked showed `src/agent.instructions/`, which groups them visually with `agent.ts` but reads like
a file rather than a folder. Say which you want before step 3; everything else is unaffected.
