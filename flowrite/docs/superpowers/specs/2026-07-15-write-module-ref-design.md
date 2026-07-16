# Design — `write-module-ref` workflow

**Date:** 2026-07-15
**Status:** Approved (brainstorming)
**Source:** convert `plugins/documentation/skills/docs-module-ref/SKILL.md` into a flowrite flue workflow.

## Goal

Add a third flowrite documentation workflow, `write-module-ref`, alongside
`write-tutorial` and `write-data-type-ref`. It documents a **module** — a cohesive
domain model of multiple related types (e.g. an HTTP model, resource management) —
producing module-level narrative (how the types work together) plus per-type
coverage. It mirrors the two-layer flowrite architecture exactly and reuses the
existing generic role subagents and shared factories.

Non-goals: cross-agent orchestration (module-ref does not invoke the
data-type-ref *agent*); interactive layout prompts (CI is non-interactive).

## Key decisions (brainstorming outcomes)

1. **Self-contained mirror of `write-data-type-ref`** (Option A). Own workflow,
   agent, actions, and skills; reuse the generic profiles + `defineDocsWriter` /
   `defineDocsWorkflow`. No new architectural mechanism.
2. **Free-form module scope.** Input is a module name; the researcher discovers
   the member types by exploring source/packages (matches the source skill's
   `$ARGUMENTS`). Research emits the discovered type set.
3. **Per-type depth tied to layout.** Flat modules use a lighter per-type surface;
   hierarchical modules use full data-type-ref depth per type.
4. **Reuse data-type-ref actions for hierarchical subpages.** The hierarchical
   loop calls the existing `research_data_type` + `write_data_type_reference` per
   type, with two new *optional, non-breaking* params on the write action
   (`outputDir`, `moduleContext`). Full depth for free, DRY, in-pattern.
5. **Cost-bounded review.** One LLM checklist pass + style loop on the narrative,
   plus deterministic method-coverage looped over every type. No per-type LLM
   checklist (that is the N×LLM cost we cut).

## Architecture

Two-layer, identical to the other write-* workflows.

### Layer 1 — workflow

`src/workflows/write-module-ref.ts`, built with `defineDocsWorkflow`.

- Input: `{ projectPath, moduleName, layout?, skipPhases? }`.
  - `layout?: 'flat' | 'hierarchical'` — optional override; default is the design
    phase's auto-rule.
- Output: unchanged `{ path, summary, insights }`. `path` is the flat page or the
  module index.
- `buildPrompt` mirrors data-type-ref: kick off the full module flow, request the
  final path + one-line summary + run retrospective.

### Layer 2 — agent

`src/agents/module-ref-writer.ts` + `.md`, built with `defineDocsWriter`:

```
defineDocsWriter({
  idLabel: 'module',
  instructions,                                   // module-ref-writer.md
  skills: [mdocConventions, moduleRefStructure, moduleRefChecklist],
  actions: [ researchModule, designModuleStructure, writeModuleOverview,
             researchDataType, writeDataTypeReference,   // reused for hier subpages
             writeCompanionExamples, integrateModuleReference, reviewModuleRef ],
})
```

Reuses all nine generic subagents (researcher, designer, drafter, reviewer,
examplesBuilder, docsIntegrator, reviewResolver, styleChecker, styleFixer),
`docsAuthorBase` profile, `local()` sandbox, cwd from `REPO_PATH`, `gh_query` tool.

The `.md` owns the orchestration and the flat/hierarchical branch.

## Actions

New actions in `src/actions/`:

### `research_module` (`research-module.ts`)
Delegates to the generic `researcher`. Discovers the module's member types and
their relationships. Output `moduleResearchSchema`:

- `moduleName`, `purpose`
- `coreTypes: string[]`, `supportingTypes: string[]`
- `types[]` — **light** per-type surface: `name`, `signature`, `category`,
  grouped key operations, key constructors, per-fact `source` refs
- `relationships` — how types compose / data flow (feeds "How They Work Together")
- `commonPatterns[]`, `integrationPoints[]`
- `installation` / `sbtDependency`, `imports[]`, `sourceFiles[]`, `groundingDetail`

Research-cached under topic `module-ref::<moduleName>` (namespaced like
data-type-ref). `isPhaseSkipped('research')` guard + skip-stub.

### `design_module_structure` (`design-module-structure.ts`)
Delegates to the generic `designer`. Applies the layout auto-rule (or honors the
`layout` override) and plans sections. Injects
`module-ref-structure/references/structure.md`. Output `moduleStructureSchema`:

- `layout: 'flat' | 'hierarchical'`
- module-section applicability: `motivation`, `installation`, `overview`,
  `howTheyWorkTogether`, `commonPatterns`, `integration`
- `typeOrder: string[]`
- flat only: per-type category grouping

Layout auto-rule (from the source skill):

| Module shape                                                   | Layout        |
|---------------------------------------------------------------|---------------|
| ≤ 4 core types, or types always used together                 | flat          |
| ≥ 5 core types, or ≥ 3 types with rich self-contained APIs     | hierarchical  |

`isPhaseSkipped('design')` guard + skip-stub.

### `write_module_overview` (`write-module-overview.ts`)
Delegates to the generic `drafter`. Writes the module narrative:

- **flat:** the whole single page `docs/reference/<module-kebab>.md`, including
  inline type sections (light coverage, `##` per type).
- **hierarchical:** `docs/reference/<module-kebab>/index.md` — narrative only,
  linking out to per-type subpages.

Injects the structure doc + writing-style rules (same temporary compile-time
injection as data-type-ref, pending the flue nested-skill fix). Writes via
`harness.fs`. `isPhaseSkipped('write')` guard returns the existing file.

### Hierarchical per-type loop (orchestrated in the `.md`, no new action)
For each type in `typeOrder`, reuse:
- `research_data_type` (deep, full `dataTypeResearchSchema`)
- `write_data_type_reference` with two new **optional** params:
  - `outputDir?` → `docs/reference/<module-kebab>` (default keeps `docs/reference`)
  - `moduleContext?` → sibling types + relationships, appended to the drafter
    prompt so each subpage is recontextualized (source Step 6)

Both params are optional and leave `write-data-type-ref` behavior byte-identical
when unused. A type whose deep research/write fails is reported in the
retrospective; the run continues (one bad type does not discard the module).

### `write_companion_examples` (reused)
Module-level cross-type examples (source Step 7 default). No change.

### `integrate_module_reference` (`integrate-module.ts`)
Delegates to the generic `docsIntegrator`. Branch:
- flat → single sidebar `doc` entry + `docs/index.md` line
- hierarchical → sidebar `category` (index link + child type pages) + `docs/index.md` line

`isPhaseSkipped('integrate')` guard.

### `review_module_ref` (`review-module-ref.ts`)
The single cost-bounded quality gate, via `runCappedReview`:
- module-ref-checklist (one LLM reviewer pass over the narrative) + style loop
- deterministic method-coverage via `computeMethodCoverage`, looped over every
  type — one `extraGates` item per type (flat: all types → the single page;
  hierarchical: each type → its subpage path)
- **no** per-type LLM data-type-ref-checklist

`isPhaseSkipped('review')` guard.

## Skills

Mirror the data-type-ref split: `SKILL.md` loaded into the agent, `references/*.md`
injected at action call sites (flue nested-skill limitation).

- `src/skills/module-ref-structure/` — SKILL.md + `references/structure.md`: the
  module-page template (opening definition → motivation → installation → overview
  → **How They Work Together** → common patterns → integration), flat vs
  hierarchical layouts, per-type section shape (light for flat). Distilled from
  source Steps 4–7.
- `src/skills/module-ref-checklist/` — SKILL.md + `references/checklist.md`:
  module-level review items (all core types documented/linked, narrative
  centerpiece present, data-flow/ASCII, patterns, integration, layout matches the
  rule, links resolve) + Review Cadence rules copied from data-type-ref-checklist.

Reuse `writing-style` and `mdoc-conventions` unchanged.

## Phase flow (in `module-ref-writer.md`)

```
research_module
  → design_module_structure
  → branch on layout:
      flat:         write_module_overview            (single page, inline types)
      hierarchical: write_module_overview (index)
                    + for each type: research_data_type + write_data_type_reference
  → write_companion_examples          (module-level cross-type examples)
  → mdoc verify                       (agent-driven, always runs)
  → integrate_module_reference
  → review_module_ref
  → retrospective
```

## Path / id semantics

- Flat: `docs/reference/<module-kebab>.md`, `id = <module-kebab>`.
- Hierarchical: `docs/reference/<module-kebab>/index.md` (`id: index`) +
  `docs/reference/<module-kebab>/<type-kebab>.md` (`id: <type-kebab>`).

## Shared-file edits (kept optional / non-breaking)

- `write-data-type-reference.ts`: add `outputDir?` and `moduleContext?` inputs.
  When absent, output path and prompt are unchanged → `write-data-type-ref`
  behavior is byte-identical.
- `computeMethodCoverage`: reused as-is (per type, per path).
- `docs-workflow.ts` `skipPhasesField` picklist: extend with any module-specific
  phase names if the phase set diverges from the shared list.

## Error handling / resume

Every new action gets the `isPhaseSkipped` guard + a skip-stub return, matching
data-type-ref. Hierarchical per-type failures are non-fatal and surfaced in the
retrospective.

## Testing

- Dry-run on a small multi-type fixture module with haiku via `--env .env.testing`,
  `FLUE_VERBOSE_TOOLS=1`. tinyoptics is single-type; a small multi-type fixture is
  needed to exercise both layouts — tracked as a testing task.
- Validate generated Scala: `sbt scalafmtAll`, then `sbt "++2.13; check"` before
  commit (per CLAUDE.md).

## Risks

- Shared `write-data-type-reference.ts` now serves two callers — mitigated by
  keeping both new params optional and defaulted.
- Layout mis-classification by the design phase — mitigated by the explicit
  `layout` override input.
- Large flat modules (many types) produce a big single page — accepted; matches
  the source skill's own flat guidance.
