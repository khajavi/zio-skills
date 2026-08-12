# Stop relaying phase results through the model

*A plan for a developer new to flowrite and Flue. Concepts first, then what is wrong and how we know,
then one commit at a time with the code, the checks, and how to undo it.*

Every Flue claim here is quoted from docs that ship in the repo. Read them yourself:

```bash
./node_modules/.bin/flue docs read reference/agent-api
./node_modules/.bin/flue docs read guide/agent-hooks
```

`pnpm exec flue` does not work here — always `./node_modules/.bin/flue`.

---

## 0. Vocabulary

**Phase.** A step of the documentation pipeline, implemented as a Flue *harness tool* — a tool declared
`harness: true`, which gets its own private conversation with a model. flowrite has six: research,
design, write, examples, integrate, review. They live in `src/tools/phases/`.

**Delegation.** A phase hands its real work to a narrow subagent (`researcher`, `designer`, `drafter`,
…) through `src/runtime/delegate.ts`. The phase's own conversation only relays.

**Tool input.** What the model *writes* to call a tool. This is the part that matters here: a tool input
is **generated text**. If a tool's input schema contains a 7 KB object, the model must emit those 7 KB,
token by token, as output.

**Run context.** `src/runtime/run-context.ts` — a module-level object holding the facts every phase
needs: `projectPath`, `request`, `skipPhases`, and (since the review collapse) `kind`. It exists because
phase tool bodies **cannot call hooks**: `useInitialData()` and `usePersistentState()` are unavailable
outside an agent render, so anything a phase needs from the agent has to be published here. One OS
process serves one run (`run-*.sh` execs a fresh node), so a module-level holder is safe.

**The research cache.** `src/runtime/research-cache.ts` — a SQLite file per documented checkout,
`.flowrite/cache/research.db`, keyed by topic. Deliberately never invalidates: the same subject against
the same checkout reuses its research across runs. **This plan does not change it.**

---

## 1. The problem

Look at what the design phase asks the model for:

```ts
// src/tools/phases/design-doc-plan.ts
input: v.object({
  typeName: v.string(),
  researchAnswers: dataTypeResearchSchema,   // ← the ENTIRE research result
}),
```

The research phase returns its findings to the model. The model then **retypes the whole thing** as
design's input. Then design returns a plan, and the model retypes *both* the research and the plan as
the write phase's input.

Measured on the archived Prism run (`fixtures/tinyoptics-archive/write-data-type-ref-turn19/flue.log`):

| relayed payload | size | tokens |
|---|--:|--:|
| research result, as re-emitted into `design_data_type_plan`'s input | 6,905 B | ~1,726 |
| design plan, as re-emitted into `write_data_type_reference`'s input | 2,511 B | ~627 |
| research result again, into the same input | 6,905 B | ~1,726 |
| **total generated purely to move data between phases** | | **~4,079** |

Three costs, in increasing order of importance:

**Money, modest.** Those are *output* tokens — $5.00/Mtok on haiku, the expensive direction, against
$1.00 for input. ~$0.02 per data-type run; ~$0.06 at sonnet rates. Prism is the small case: a module run
repeats the per-type relay once per documented type.

**Latency, real.** Generating ~4,000 tokens of JSON is a minute or two of wall clock, multiplied by the
type count on a module run. The Prism run took 45 minutes.

**Correctness, the actual reason.** A value the model retypes is a value the model can change. This is a
known bug class here, recorded in the earlier plan's own "deliberately not in this plan" section:

> "The model relays `path`, `typeNames` and `layout` between phases out of its own conversation, which is
> how stale values get in."

It has bitten: a review reported stale line numbers from a draft that had already been fixed, because
the numbers came from a relayed copy rather than the file.

### Why this is also why we have three design tools

`design_data_type_plan`, `design_module_plan` and `design_tutorial_plan` are three tools
for exactly one reason: each embeds a *different research schema* in its input. Remove the payload from
the input and the three inputs become nearly identical. The same argument applies to the three write
tools. So this change is also the honest version of "why not one tool with multiple schemas" — the
schemas differ because state travels through the model, not because the work differs.

---

## 2. What we are building

```
NOW                                          AFTER
research ──returns 7 KB──▶ model             research ──▶ store  (and returns a short receipt)
                            │                                │
                     retypes 7 KB                            │ loads
                            ▼                                ▼
design ─────returns plan──▶ model             design({ subject }) ──▶ store
                            │                                │
                  retypes 7 KB + plan                        │ loads
                            ▼                                ▼
write                                         write({ subject, … })
```

The store is **in memory**, not the database. One process per run, and design always precedes write
inside it, so a module-level map is sufficient, free, and needs no schema or migration. The research
cache stays on disk because its job is different: reuse *across* runs.

---

## 3. Decisions taken

1. **In-memory store, not SQLite.** See above. `research-cache.ts` is untouched.
2. **Phases keep their per-kind tools.** This plan removes the relay; it does not merge tools. Whether
   design and write then collapse is a separate question, answered by what the inputs look like
   afterwards — and worth deciding with the code in front of us rather than now.
3. **Research keeps returning its result to the model.** The model needs to *see* the findings to
   orchestrate (it decides the page id, the subpages, the layout override). What changes is that
   downstream tools stop *taking it back*.
4. **The store is keyed by (artifact kind, subject).** Not by run: a module run legitimately holds one
   module research plus one data-type research per documented type.

---

## 4. The code

### 4.1 `src/runtime/phase-outputs.ts` — new

```ts
import type { DocKind } from './run-context.ts';

/**
 * What each phase produced this run, so the next phase can load it instead of being handed it back.
 *
 * A tool input is generated text: an input schema carrying a 7 KB research object makes the model
 * retype 7 KB as output tokens, twice per run, and a value the model retypes is a value it can change.
 * The measured relay on the archived Prism run was ~4,079 generated tokens moving data between phases,
 * and the stale-line-numbers bug came from a relayed copy diverging from the file.
 *
 * In memory rather than in the database, deliberately: one OS process serves one run (each run-*.sh
 * execs a fresh node), and design always precedes write inside that process. The research cache is on
 * disk for a different reason — reuse ACROSS runs — and is untouched by this.
 *
 * Keyed by artifact kind AND subject because one run can hold several: a hierarchical module reference
 * researches the module plus one data type per documented type.
 */

/** The kind of artifact a stored output describes — the run's kind, or 'data-type' for a subpage. */
type ArtifactKind = DocKind;

const researchBySubject = new Map<string, unknown>();
const planBySubject = new Map<string, unknown>();

const key = (kind: ArtifactKind, subject: string) => `${kind}::${subject}`;

export function recordResearch(kind: ArtifactKind, subject: string, value: unknown): void {
  researchBySubject.set(key(kind, subject), value);
}

export function recordPlan(kind: ArtifactKind, subject: string, value: unknown): void {
  planBySubject.set(key(kind, subject), value);
}

/**
 * The research for one subject, or a thrown error naming what to do.
 *
 * Thrown rather than returning undefined: the runtime surfaces a thrown error to the calling model as a
 * tool error, which it reads as an instruction — the mechanism phase-guard.ts and the review budget both
 * rely on. A phase that silently drafted from nothing would produce a plausible, ungrounded page.
 */
export function requireResearch(kind: ArtifactKind, subject: string): unknown {
  const value = researchBySubject.get(key(kind, subject));
  if (value === undefined) {
    throw new Error(
      `No research recorded for the ${kind} "${subject}". Run the research phase for it first — ` +
        `research_${kind === 'data-type' ? 'data_type' : kind === 'module' ? 'module' : 'tutorial_topic'} — ` +
        `then call this again with the same subject spelled identically.`,
    );
  }
  return value;
}

/** The design plan for one subject, or undefined when the kind has no design phase (module subpages). */
export function findPlan(kind: ArtifactKind, subject: string): unknown | undefined {
  return planBySubject.get(key(kind, subject));
}

/** Clear both stores. Tests only — module state has no other seam. */
export function __resetPhaseOutputsForTests(): void {
  researchBySubject.clear();
  planBySubject.clear();
}
```

### 4.2 `research.ts` — record on the way out

One line inside `researchSubject`, after the delegation and the cache write:

```ts
  writeResearchCache(repoPath, opts.cacheTopic, research);
  recordResearch(opts.artifactKind, opts.subject, research);
  return research;
```

`artifactKind` and `subject` join the options each tool already passes (`'data-type'` + `data.typeName`,
`'module'` + `data.moduleName`, `'tutorial'` + `data.topic`). The cache-hit path must record too —
otherwise a cached run leaves the store empty and every downstream phase throws.

### 4.3 `design-doc-plan.ts` — load instead of receive

```ts
  input: v.object({
    typeName: v.pipe(v.string(), v.description('The data type whose research to plan from, e.g. "Chunk"')),
  }),
```

and in the body, replacing `data.researchAnswers`:

```ts
  researchAnswers: requireResearch('data-type', data.typeName),
```

then record the plan before returning: `recordPlan('data-type', data.typeName, plan)`.

The module tool keeps `layoutOverride` and `shapeOverride` — those are caller intent, not relayed state.

### 4.4 `write-doc.ts` — load both

```ts
  input: v.object({
    typeName: v.pipe(v.string(), v.description('The data type to write, e.g. "Chunk"')),
    outputDir: /* unchanged */,
    moduleContext: /* unchanged */,
  }),
```

`researchAnswers` and `plan` are gone from every write input. The body loads them:

```ts
    const research = requireResearch('data-type', data.typeName) as DataTypeResearch;
    const plan = findPlan('data-type', data.typeName);
```

Note `findPlan`, not `requireResearch` — see the open decision below.

### 4.5 The id, which was derived from the payload

`write_data_type_reference` currently computes its filename from the payload it was handed:

```ts
const id = toKebabCase(data.researchAnswers.typeName);
```

With the payload gone it uses the input directly — `toKebabCase(data.typeName)` — which is the same
string by construction, since the research was recorded under it.

---

## 5. Build order — one commit each

| # | commit | contents |
|--:|---|---|
| 1 | `feat(runtime): a store for phase outputs` | `phase-outputs.ts` + its tests. Nothing imports it; inert. |
| 2 | `feat(research): record research into the store` | research records on both the fresh and cached paths. Still passed through the model as well — nothing breaks. |
| 3 | `refactor(design): load research from the store` | design's three inputs shed `researchAnswers`; design records its plan. |
| 4 | `refactor(write): load research and plan from the store` | write's three inputs shed `researchAnswers` and `plan`. |
| 5 | `docs(instructions): the phases pass subjects, not payloads` | the three instruction files stop telling the model to pass "the exact research object". |

Steps 1–2 change no behaviour, which is deliberate: the risky part is one commit (3 and 4 together are
the switch), and reverting either leaves a working tree.

### After every commit

```bash
cd /home/milad/sources/zio-skills/flowrite
./node_modules/.bin/tsc --noEmit
pnpm --config.verify-deps-before-run=false test          # 46 passing today
```

Plus the mount probe, which catches a lost tool that tsc will not:

```bash
node --import ./test-setup/md-imports.mjs -e "
import('./src/agent.ts').then(m => {
  for (const [k, c] of Object.entries(m.KINDS)) console.log(k.padEnd(10), c.tools.map(t => t.name).join(', '));
});"
```

### The end-to-end check

The changed handoffs are research → design → write, so the run must exercise those and nothing else
matters. Skip the tail:

```bash
rm -rf fixtures/tinyoptics/.flowrite/cache/research.db     # force a real research phase once
bash fixtures/tinyoptics/scripts/run-data-type-ref.sh "Prism" write-examples,integrate
```

Then repeat **without** clearing the cache, to exercise the cache-hit recording path — the one place a
missing `recordResearch` would leave the store empty and every later phase throwing.

Print the log path (the scripts echo `flue log: …` as their first line). Afterwards:

```bash
bash fixtures/tinyoptics/scripts/archive-docs.sh <log-path> write-data-type-ref
```

> **Commit run-script or fixture-script edits BEFORE archiving.** `archive-docs.sh` resets the fixture
> with `git checkout -- .`, which has already silently reverted uncommitted script changes once in this
> branch. And never `git add -A` while a run's output is in the tree.

What to compare against turn19:

| what | expected |
|---|--:|
| `design_data_type_plan` tool-start line | 6,905 B → a few hundred |
| generated tokens moving data between phases | ~4,079 → ~0 |
| the page itself | unchanged in structure and grounding |

---

## 6. The open decision, which needs your call

**A module run writes per-type subpages with no design phase behind them.** `KINDS.module.tools`
mounts `write_data_type_reference` but *not* `design_data_type_plan`, while
`write_data_type_reference` requires `plan: dataTypePlanSchema`. So today the model
**fabricates** a structural plan for every subpage — invented, not designed.

**It has already produced a wrong page, and there is a log to prove it.** Parsing every
`write_data_type_reference` call from `fixtures/tinyoptics-archive/write-module-ref-turn3/flue.log` — 15
calls, each read as one balanced JSON object, so this is not two log lines spliced together — gives:

| call | `researchAnswers.typeName` | `plan.constructionOrder` | `plan` methods |
|--:|---|---|---|
| 1 | **`Lens`** | **`["Iso.apply"]`** | `to`, `from`, `reverse`, `modify`, `andThen`, `asLens` |
| 2-15 | self-consistent | | |

The drafter was handed Lens's research and **Iso's plan**. Lens has `get`, `set`, `modify`, `andThen`,
`asOptional`; it has no `to`, `from`, `reverse` or `asLens`. A drafter that followed its plan would
document four methods the type does not have. One call in fifteen — rare enough to pass unnoticed, often
enough to ship a broken page.

Nothing catches it: `dataTypePlanSchema` validates the *shape* (are the booleans booleans?) and
never that the plan describes the same type as the research. And the plan rides inside ~7 KB of relayed
JSON, where a wrong `notes` field three levels down is invisible.

The relay hides this. Remove it and the question is forced, because there is no plan in the store to
load — the defect becomes a missing value rather than a wrong one. Three options:

1. **Draft subpages without a plan** *(recommended)*. `findPlan` returns undefined, and the drafter
   works from the research plus the module context, which is what the fabricated plan effectively
   amounted to. Cheapest, and it makes an existing behaviour honest instead of hidden.
2. **Mount `design_data_type_plan` for module runs too.** Most correct, and most expensive: one
   extra design phase per documented type, on the phase that already costs 86s for one type.
3. **Derive the subpage plan from the module plan.** The module plan has `typeGroups` with a
   `core`/`supporting` depth per type, which is roughly what a subpage needs. Cheap, but it is new
   behaviour rather than a preserved one, so it deserves its own measurement.

I recommend 1 for this plan and 3 as a follow-up experiment. Note what the evidence above does to the
framing: option 1 is no longer "preserve today's outcome honestly", it is a bug fix. The fabricated plan
is not harmless filler — it went wrong once in fifteen calls and pointed a drafter at four methods that
do not exist. Mixing option 3's new behaviour into the same commit would make a bad result
unattributable, which is why it stays a separate experiment.

---

## 7. How to undo

Every step is one commit:

```bash
git log --oneline feature/flue-2-migration | head
git revert <sha>
```

- **Steps 1–2** are additive; reverting is inert.
- **Steps 3–4** are the switch. Reverting restores the payload-carrying inputs exactly, because the
  schemas are unchanged apart from the removed fields. Nothing persists between runs, so there is no
  data to migrate back.
- **Step 5** is prose.

**Revert trigger, decided now:** if the verification run produces a page that is *less* grounded — fewer
source citations, or a section the research covered gone missing — revert steps 3–4 rather than
debugging forward. The relay is wasteful, not broken; a worse page is a strictly worse trade.

---

## 8. Deliberately not here

- **Merging design or write into one tool.** Possibly the right follow-up once the inputs are small, but
  it is a separate decision with its own argument, and bundling it would make this change's result
  unattributable.
- **Persisting phase outputs to disk.** Would let a run resume mid-pipeline after a crash. Today skipping
  design implies skipping write (a skipped design returns a marker placeholder its consumers never
  read), so in-memory is sufficient; disk only buys crash resume, which nothing asks for yet.
- **Removing `research`'s return value.** The model needs to see the findings to orchestrate — it picks
  the page id, decides which subpages exist, and may override the layout. Only the *taking it back* is
  waste.
- **The examples, integrate and review phases.** They already pass paths, not payloads. Review takes
  `{ path }` and reads the file — which is exactly the shape this plan moves the others toward.
