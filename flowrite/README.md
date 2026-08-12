# flowrite

**Autonomous documentation agents for ZIO libraries, built on [Flue](https://flueframework.com).**

flowrite reads a real ZIO library checkout and writes documentation that actually
compiles: tutorials and exhaustive data-type reference pages, grounded in the
library's own source, verified with `mdoc`, and integrated into the docs site.

It exists as much as a *demonstration* as a tool. Every non-trivial documentation
task here is handled by an agent whose behavior lives in prose and skills — not in
imperative TypeScript. The point of this README is to show how little code that
takes, and how tight the build → test → observe → fix loop is when you build agents
this way.

---

## Why Flue

An agent is not a program you write step by step. It's a *context you assemble*:

> **agent = model + instructions + tools + skills + subagents + sandbox**

The code is just the wrapper. The writer reads a plain request, decides what kind of document it
is, and then every capability it has is a thing you *hand it*, not a branch you write:

```ts
// src/agents/docs-writer.ts
'use agent';
export function DocsWriter() {
  const [kind] = usePersistentState<DocKind | null>('docKind', null);
  const [subject] = usePersistentState<string | null>('subject', null);
  useRunBasics(initialData, request);         // model + sandbox + run context

  if (kind === null) return classificationGate();  // one turn: which kind, which subject?

  const config = KINDS[kind];                 // the whole per-kind difference, in a table
  return useDocsWriter({
    instructions: config.instructions,        // who it is — a Markdown file
    skills: config.skills,                   // e.g. mdocConventions + structure + checklist
    tools: config.tools,                      // only THIS kind's phase tools, never all three
    runDirective: config.directive(subject),
  });
}

// useDocsWriter is a custom hook — it declares the skills, the guarded phase tools, and the nine
// shared roles with useSubagent.
```

Notice what's *not* there: no "step 1 research, step 2 design, step 3 write"
state machine. The agent is given a goal, a capable environment, and a loop. It
finds the path — read → act → observe → correct → repeat. Hardcoded steps are
brittle; they break the moment reality diverges from the script (and with an LLM
in the loop, reality always diverges).

The interesting engineering therefore moves out of `.ts` files and into:

- **instructions** (`src/agents/*.md`) — who the agent is and how it should behave,
- **skills** (`src/skills/*/SKILL.md`) — expertise loaded on demand (structure
  templates, checklists, `mdoc` conventions, writing-style rules),
- **phase tools** (`src/phases/*.ts`) — a research/write/verify/integrate step, each
  delegating to a specialized role with a `valibot` result schema,
- **roles** (`src/subagents/*`) — generic delegates (researcher, drafter, reviewer…)
  reused across every writer.

## What's in the box

One agent, `docs-writer`, which writes three kinds of document:

| Kind | Writes |
|------|--------|
| `data-type` | Exhaustive, API-complete reference pages |
| `module` | Module narrative plus per-type coverage, flat or hierarchical |
| `tutorial` | Narrative, pedagogical guides with companion examples |

Ask for what you want in plain words — the writer works out which kind it is and what the subject
is, and mounts only that kind's phase tools:

```bash
flue run src/agents/docs-writer.ts --id dtr-Chunk \
  -m "Please write reference documentation for the Chunk data type" \
  --data '{"projectPath":"/path/to/checkout"}'
```

`--data` carries only what a sentence cannot express: the checkout path, phases to skip, and the
module layout override. When a request is ambiguous ("write docs for Chunk" — a reference page or a
tutorial?) the writer asks instead of guessing, because guessing spends hours on the wrong document.

The agent captures a structured result plus a **run retrospective** in its final
reply.

The `fixtures/tinyoptics/` directory is a small ZIO optics library (Lens, Prism,
Optional) used as the test target — real Scala source with a real `sbt`/`mdoc`
docs build, small enough to iterate on cheaply.

---

## The development workflow

This is the part worth reading. Building a documentation agent doesn't look like
writing a parser and running its test suite. It looks like a *conversation with the
model's behavior*: you shape context, run it against a real repo, read what it
actually did, and feed the surprises back in. Here is the loop, start to finish,
using the reference-page writer as the running example.

### 1. Plan the feature

The reference-page writer started as a plan, not code. The tutorial-writer already
existed, so the question was: how much can be *reused*, and where does a reference
page genuinely differ?

The design decisions were about **context**, not control flow:

- Reference pages are organized by the type's **public API**, not a narrative arc —
  so research needs an API-surface-shaped result schema (every constructor, every
  method with its real signature, every subtype), whereas tutorials use a
  pedagogical schema.
- The generic delegate roles (researcher, drafter, reviewer, …) could be shared
  wholesale; the *document-kind-specific* focus (schema, structure template,
  checklist) gets injected by the phase tools at each delegation call site.
- Every researched fact must carry a **source citation** (`path:L<start>-L<end>`)
  so the drafter can't hallucinate an API that isn't in the source.

That plan is deliberately about *what the agent knows and produces*, never a
prescribed sequence of moves.

### 2. Implement — assemble the context

Implementation is mostly Markdown and schemas:

- Write the kind's identity in `src/agents/data-type-ref-writer.md`, and add its row to `KINDS`.
- Add skills: `data-type-ref-structure` (page layout), `data-type-ref-checklist`
  (what "done" means), reusing `mdoc-conventions` and `writing-style`.
- Write the phase tools (`research-data-type.ts`, `write-data-type-reference.ts`, …),
  each defining a `valibot` result schema and delegating to a generic role
  with a kind-specific prompt. The research schema alone — constructors,
  `coreOperations`, `subtypesOrVariants`, per-fact `source` — *is* the spec that
  keeps the writer honest.
- Wire it all into the agent function shown above, and declare what a run needs
  with its `initialData` static.

Model choice is centralized in `src/shared/models.ts` as **tiers**, each
env-overridable per run — so the same agent runs on cheap models under test and
capable ones in production without a code change:

```ts
writer:     { model: WRITER_MODEL     ?? 'anthropic/claude-sonnet-4-6', effort: 'high'   },
researcher: { model: RESEARCHER_MODEL ?? 'anthropic/claude-haiku-4-5',  effort: 'low'    },
reviewer:   { model: REVIEWER_MODEL   ?? 'anthropic/claude-sonnet-4-6', effort: 'low'    },
// …
```

### 3. Test the agent on tinyoptics

`.env.testing` pins every tier to Haiku at `low` effort — the whole loop runs for
cents:

```bash
# .env.testing selects cheap models; --data points at the tinyoptics fixture
flue run src/agents/docs-writer.ts \
  --env .env.testing --id dtr-Prism \
  -m "Please write reference documentation for the Prism data type" \
  --data '{ "projectPath": "fixtures/tinyoptics" }'
```

> If `pnpm exec flue` misbehaves, call the binary directly: `./node_modules/.bin/flue run …`.

The agent then runs the full flow against real Scala:
research → write → verify compliance → method coverage → `mdoc` verify → examples →
format/lint → integrate → review. It's driving `sbt`, reading source, editing
Markdown, and compiling — in a sandbox, on a throwaway checkout, with no human in
the loop.

### 4. Investigate the logs

Every run writes a `flue.log` and finishes with three lines that make the run
*observable by construction*. From an actual tutorial run on `Prism`:

```
info write-tutorial token consumption: 6671373 tokens
     (in 33357, out 88613, cacheRead 6180078, cacheWrite 369325)
     across 248 turns, cost $1.9397
info write-tutorial component usage: [ … per-component call counts, tokens, cost … ]
```

The **component usage** line is the money view — it breaks spend down by subagent,
action, skill, and tool, so you can see exactly where the tokens went:

| component | calls | cost |
|-----------|-------|------|
| `docs_integrator` (subagent) | 1 | $0.41 |
| `style_checker` (subagent) | 10 | $0.37 |
| `examples_builder` (subagent) | 1 | $0.34 |
| `tutorial_drafter` (subagent) | 1 | $0.25 |
| `bash` (tool) | 120 | — |
| `read` (tool) | 48 | — |

That table is how the `ARCHITECTURE-REVIEW.md` in this repo was written: it
immediately flagged that some subagents were silently inheriting Sonnet + `high`
thinking for what is really mechanical work — the single biggest cost leak, fixable
by handing them a cheaper tier. Set `FLUE_VERBOSE_TOOLS=1` to also stream every
tool/subagent call with its arguments, result, and duration when you need to see
*what* a step did, not just how much it cost.

### 5. Find issues for the next round of fixes

The workflow doesn't just run the agent — it asks the agent, at the end, for a
**retrospective**: the real obstacles it hit and, crucially, a concrete
`suggestedFix` for each. The result schema forces the shape:

```ts
insights: array({
  phase:        picklist([...]),
  obstacle:     'What actually went wrong or slowed you down this run',
  resolution:   'How you got past it',
  suggestedFix: 'A concrete instruction/tool/schema change to prevent it — or null',
})
```

Real insights from the `Prism` run above:

- **examples phase** — "original tutorial code tried to compose `circleRadiusP` with
  itself (both `Prism[Circle, Double]`); the correct pattern needs nested sum
  types." → *suggestedFix: verify composition type signatures against the examples
  builder's validated output before writing the section.*
- **mdoc phase** — "compile failed on that type mismatch plus a stray `prism-dup.md`
  left in the docs dir." → *suggestedFix: clean up generated files before compiling.*
- **review phase** — "missing audience statement, missing learning objectives,
  code blocks mixing multiple concepts." → *suggestedFix: load the checklist and
  style skills before the write phase so those are planned from the start.*

Each `suggestedFix` is an edit to an **instruction, skill, or schema** — never a new
`if` branch. That closes the loop: the agent tells you how to improve its own
context, you edit a `.md` or a `valibot` schema, and re-run against the fixture.
Old runs are archived under `fixtures/tinyoptics-archive/<run>/flue.log` so you can
diff behavior across iterations of the prompt.

> **Resuming a run.** The tail phases are expensive; the `skipPhases` input lets you
> re-run only the verification/examples/integrate/review tail against artifacts a
> previous run already produced — so fixing a review-phase instruction doesn't cost
> a fresh research pass. Research results are also content-cached under `.cache/`.

---

## Repository layout

```
src/
  agents/        # one writer (.ts) + one identity (.md) per kind of document
  phases/        # research / write / verify / integrate steps (+ result schemas)
  subagents/     # generic delegate roles, shared across every writer
  skills/        # structure templates, checklists, mdoc + writing-style rules
  tools/         # gh query, method-coverage, todo tools
  shared/        # model tiers, token/component tracking, caching, skip-phases
fixtures/
  tinyoptics/          # the ZIO optics library used as the test target
  tinyoptics-archive/  # archived flue.log per run, for diffing behavior
```

## Getting started

```bash
pnpm install
cp .env.testing.example .env.testing   # add ANTHROPIC_API_KEY

# run against the bundled fixture (cheap models)
flue run src/agents/docs-writer.ts --env .env.testing \
  --id dtr-Prism \
  -m "Please write reference documentation for the Prism data type" \
  --data '{ "projectPath": "fixtures/tinyoptics" }'
```

Flue's own docs ship with the packages — read them directly rather than guessing at
API signatures:

```bash
flue docs                 # list documentation pages
flue docs read <path>     # print a page as Markdown
flue docs search <query>  # search the docs
```

(or browse `node_modules/@flue/{runtime,cli,sdk}/docs`).
