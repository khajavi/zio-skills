# ZIO Skills — Comprehensive Skill Review

**Date**: 2026-05-01
**Repo**: github.com/khajavi/zio-skills (marketplace `ziogenetics`)
**Reviewer**: Skill Reviewer rubric (10 dimensions × 1–5)
**Skills reviewed**: 28 across 2 plugins
**Methodology**: Each `SKILL.md` (and any sibling `references/`, `scripts/`, `CHECKLIST.md`) was scored against the [Skill Reviewer rubric](https://github.com/agentskill-sh/learn) by domain-focused subagents. Per-dimension scores are 1–5 (3 is acceptable, not failure). Totals are out of 50 when scripts are bundled, out of 45 when not (D9 = N/A).

---

## Resolved Issues

This section tracks recommendations from the original review that have been addressed. Per-skill score tables below reflect the **state at review time** and do not yet incorporate these fixes — they will be re-scored at the next quarterly review.

| # | Recommendation                                                            | Status     | Commit    | Date       |
|---|---------------------------------------------------------------------------|------------|-----------|------------|
| 3 | Document exit codes and add `--help` to every helper script               | ✅ Resolved | `ac2591f` | 2026-05-01 |

### Resolved #3 — Helper script polish (`ac2591f`)

All five bundled helper scripts now expose a `-h` / `--help` flag with full usage, an arguments table, an exit-code table, and worked examples. Exit codes were also standardized to a grep-style convention across all five:

- `0` — success
- `1` — result indicates a problem (violations found / no public members)
- `2` — invocation error (missing/extra arguments, file not found)

Previously, several scripts conflated invocation errors with "result-has-issues" by using exit `1` for both — downstream callers could not distinguish "the check ran and found problems" from "the check couldn't run at all". They can now.

The corresponding `SKILL.md` files (`docs-writing-style`, `docs-mdoc-conventions`, `docs-report-method-coverage`, `docs-data-type-list-members`, `docs-find-documentation-gaps`) now publish the exit-code table inline so agents and CI scripts know what to expect without spawning the script.

**Expected score impact at next review:**

- **D9 (Scripts Quality)** mean was 3.83 across the 5 scripts → expected ~4.6 (5/5 if structured-output is also added; the next item to address).
- **D7 (Error Handling)** for the five host skills was 4.0 → expected ~4.4 because invocation errors now have a documented separate exit code.
- **D5 (Instruction Clarity)** for `docs-data-type-list-members` and `docs-report-method-coverage` was 5/5 already; their SKILL.md content is now richer (exit-code table + cross-skill pipeline example) but the score is already ceilinged.

### Open recommendations

The following from the original "High-priority" list are still open:

- **#1** Add a "Common Failures" mini-table to every skill (~10–15 lines per skill).
- **#2** Adopt the `CHECKLIST.md` sibling pattern for all doc-authoring skills (currently only `docs-tutorial` and `docs-how-to-guide` use it).
- **#4** Move embedded examples and JSON blocks into `references/examples/` (5 specific cases identified in this report).
- **#5** Resolve the `docs-module-ref` flat-vs-hierarchical contradiction (lines 52–63).
- **#6** Add structured (JSON) output mode to helper scripts — would lift the remaining D9 gap on `extract-members.scala` and `check-method-coverage.sh`.
- Plus low-priority polish items #7–#10.

---

## Executive Summary

- **Mean score across all 28 skills**: **85.8 %**  (≈ 39.6 / 46.4 expected max).
- **Top performers** (≥ 93 %): `docs-enrich-section` (44/45), `docs-tutorial` (43/45), `docs-mdoc-conventions` (47/50), `docs-report-method-coverage` (47/50), `docs-skill-retrospection` (42/45), `docs-verify-compliance` (42/45), `zio-http-datastar` (42/45).
- **Needing the most work** (< 78 %): `zio-http-openapi-to-endpoint` (34/45), `docs-document-pr` (34/45), `docs-how-to-guide` (34/45), `docs-organize-types` (34/45), `docs-module-ref` (35/45).
- **Pervasive weakness**: **D7 Error Handling** (median 3/5). 21 of 28 skills lack explicit error tables, validation loops, or recovery paths.
- **Pervasive strength**: **D1 Frontmatter** is uniformly excellent (5/5 on every skill — names, descriptions, allowed-tools all spec-compliant).

The ecosystem is healthy. There are no broken or fundamentally misshapen skills; the gap between best and worst is style and rigor, not correctness.

---

## How to Read This Report

```
Score → Meaning
 5    Production-ready in this dimension
 4    Mostly good; one minor gap
 3    Acceptable; could be better
 2    Significant issue worth fixing
 1    Fundamental problem
```

Total bands per the rubric:

| Band              | Total      | Meaning                                       |
|-------------------|------------|-----------------------------------------------|
| Production-ready  | 40–50      | Minor polish at most                          |
| Good foundation   | 30–39      | Address flagged issues before broad rollout   |
| Needs work        | 20–29      | Multiple dimensions require rewriting         |
| Restructure       | < 20       | Consider rebuilding                           |

All 28 skills land in **Production-ready** or **Good foundation** — none below 30. The top quartile (≥ 42) is genuinely best-in-class.

---

## Headline Findings

### 1. Error handling is the single biggest lever

Median **D7** score is 3/5. Common gaps:
- Scripts (`scan-undocumented.sh`, `extract-members.scala`, `check-method-coverage.sh`) document no exit codes in their `SKILL.md`.
- Doc-creation skills (`docs-how-to-guide`, `docs-document-pr`, `docs-module-ref`) say "fix mdoc errors" but never enumerate common failure modes (unresolved imports, sealed-trait extension, `mdoc:reset` vs `mdoc:nest`, etc.).
- ZIO HTTP skills (`zio-http-scaffold`, `zio-http-test`, `zio-http-endpoint-to-openapi`) have zero coverage of port conflicts, dependency resolution, or generation failures.

**Recommended fix pattern (apply once, copy across)**: a small "Common Failures" table near the end of each SKILL.md, listing symptom → cause → fix, plus a `## Validation` section that shows the agent how to verify success after each fragile step.

### 2. Progressive disclosure pays off — adopt the references/ pattern more widely

Every skill above 91 % uses one of these patterns:
- A sibling `CHECKLIST.md` (only `docs-tutorial` and `docs-how-to-guide` do).
- A sibling `references/` directory (`zio-http-template2`, `zio-http-test`, `zio-http-datastar`, `docs-mdoc-conventions`).
- A bundled helper script that the SKILL.md delegates to (`docs-mdoc-conventions`, `docs-writing-style`, `docs-data-type-list-members`, `docs-report-method-coverage`).

Skills that keep all material inline (`docs-document-pr`, `docs-module-ref`, `zio-http-imperative-to-declarative`, `zio-http-openapi-to-endpoint`) end up with 300–400-line SKILL.md files where Phase 2 is dense and gets skipped.

**Recommended fix**: when a SKILL.md exceeds 250 lines, ask: "Could the example list, the OpenAPI JSON, or the heuristics table live in `references/<topic>.md`, with one-line load triggers in SKILL.md?" Almost always, yes.

### 3. The CHECKLIST.md pattern should be standard for doc-authoring skills

`docs-tutorial`'s CHECKLIST.md (30+ verification items, mandatory mdoc gate) is the single biggest reason it scores 95.6 %. `docs-how-to-guide` has one too but the SKILL.md front-loads 20 research questions that should likewise live in a checklist or reference.

**Recommended fix**: every doc-authoring skill (`docs-data-type-ref`, `docs-module-ref`, `docs-add-missing-section`, `docs-document-pr`) should ship a `CHECKLIST.md` covering content / technical accuracy / examples / style / integration.

### 4. Helper-script polish

`docs-data-type-list-members/extract-members.scala`, `docs-report-method-coverage/check-method-coverage.sh`, `docs-find-documentation-gaps/scan-undocumented.sh`:

- None implement `--help`.
- None document their exit codes (0 = success, 1 = violations, 2 = error).
- `extract-members.scala` produces output keyed by hardcoded section headers (`=== Public API ===`); `check-method-coverage.sh` parses these with regex — brittle. JSON output would be more robust for piping.

These are quick wins (1–2 hour total).

### 5. Description (D2) and Frontmatter (D1) are uniformly excellent

Every skill scores 5/5 on **D1**, and 24 of 28 score 5/5 on **D2**. Trigger keywords are well-chosen, third-person imperative voice is consistent, scope distinction between similar skills (`docs-data-type-ref` vs `docs-module-ref`, `docs-tutorial` vs `docs-how-to-guide`) is clear. Whatever process produced these descriptions should be preserved.

---

## Plugin Summaries

### Plugin: `zio-skills` (8 skills, mean 83.9 %)

| Skill                                | Lines | Scripts | refs/ | Total   | %     |
|--------------------------------------|------:|--------:|------:|---------|------:|
| zio-http-datastar                    | 360   | no      | yes   | 42/45   | 93.3  |
| zio-http-knowledge                   | 61    | no      | no    | 40/45   | 88.9  |
| zio-http-scaffold                    | 197   | no      | no    | 39/45   | 86.7  |
| zio-http-endpoint-to-openapi         | 292   | no      | no    | 38/45   | 84.4  |
| zio-http-test                        | 775   | yes     | yes   | 41/50   | 82.0  |
| zio-http-imperative-to-declarative   | 388   | no      | no    | 36/45   | 80.0  |
| zio-http-template2                   | 760   | no      | yes   | 36/45   | 80.0  |
| zio-http-openapi-to-endpoint         | 288   | no      | no    | 34/45   | 75.6  |

**Common pattern issues**: no error-handling tables anywhere; gotchas / "what can go wrong" sections missing; OpenAPI/Imperative-to-Declarative skills lack `references/`.

### Plugin: `documentation` (20 skills, mean 86.6 %)

| Skill                          | Lines | Scripts | refs/ | CHECKLIST | Total   | %     |
|--------------------------------|------:|--------:|------:|----------:|---------|------:|
| docs-enrich-section            | 101   | no      | no    | no        | 44/45   | 97.8  |
| docs-tutorial                  | 361   | no      | no    | yes       | 43/45   | 95.6  |
| docs-mdoc-conventions          | 294   | yes     | yes   | no        | 47/50   | 94.0  |
| docs-report-method-coverage    | 14    | yes     | no    | no        | 47/50   | 94.0  |
| docs-skill-retrospection       | 137   | no      | no    | no        | 42/45   | 93.3  |
| docs-verify-compliance         | 21    | no      | no    | no        | 42/45   | 93.3  |
| docs-data-type-list-members    | 17    | yes     | no    | no        | 46/50   | 92.0  |
| docs-writing-style             | 123   | yes     | no    | no        | 44/50   | 88.0  |
| docs-critique                  | 232   | no      | no    | no        | 39/45   | 86.7  |
| docs-check-compliance          | 115   | no      | no    | no        | 39/45   | 86.7  |
| docs-integrate                 | 58    | no      | no    | no        | 39/45   | 86.7  |
| docs-data-type-ref             | 372   | no      | no    | no        | 39/45   | 86.7  |
| docs-research                  | 60    | no      | no    | no        | 38/45   | 84.4  |
| docs-examples                  | 228   | no      | no    | no        | 38/45   | 84.4  |
| docs-add-missing-section       | 313   | no      | no    | no        | 37/45   | 82.2  |
| docs-find-documentation-gaps   | 115   | yes     | no    | no        | 41/50   | 82.0  |
| docs-module-ref                | 411   | no      | no    | no        | 35/45   | 77.8  |
| docs-document-pr               | 379   | no      | no    | no        | 34/45   | 75.6  |
| docs-how-to-guide              | 292   | no      | no    | yes       | 34/45   | 75.6  |
| docs-organize-types            | 270   | no      | no    | no        | 34/45   | 75.6  |

**Common pattern issues**: error handling weak (D7 mean 3.4); progressive disclosure inconsistent (D8 mean 4.0, but the long doc-authoring skills drag it down); missing "Common Mistakes" sections in 14 of 20.

---

## Detailed Per-Skill Reviews

The skill blocks below are sorted by total score, descending, within each plugin.

---

### Plugin: `documentation`

#### docs-enrich-section — **44/45 (97.8 %)**

**Path**: `plugins/documentation/skills/docs-enrich-section/SKILL.md`
**Lines**: 101 · **Scripts**: no · **References**: no · **Checklist**: no

| # | Dimension              | Score | Note                                                                                  |
|---|------------------------|-------|---------------------------------------------------------------------------------------|
| 1 | Frontmatter            | 5/5   | Valid name; clear description ("section lacks motivation → enrich").                  |
| 2 | Description Quality    | 5/5   | Precise trigger ("section exists but lacks motivation or use-cases").                 |
| 3 | Conciseness            | 5/5   | 101 lines, every section earns its keep.                                              |
| 4 | Structure              | 5/5   | Tight: Signals → Research → 5-part Expansion → Common Mistakes → Verification.        |
| 5 | Instruction Clarity    | 5/5   | Five-part expansion pattern (lines 34–66) is reusable as a template.                  |
| 6 | Freedom Calibration    | 5/5   | Research is directed but flexible; example checklist optional.                        |
| 7 | Error Handling         | 4/5   | mdoc gate present; no recovery loop documented if mdoc fails after enrichment.        |
| 8 | Progressive Disclosure | 5/5   | Research → template → verification, no unnecessary deferred content.                  |
| 9 | Scripts Quality        | N/A   |                                                                                       |
|10 | Completeness           | 5/5   | Common Mistakes table covers edge cases.                                              |

**Strengths**: 5-part expansion pattern is reusable across the docs/ tree; Common Mistakes table (lines 75–83) is pragmatic.

---

#### docs-tutorial — **43/45 (95.6 %)**

**Path**: `plugins/documentation/skills/docs-tutorial/SKILL.md`
**Lines**: 361 · **Scripts**: no · **References**: no · **Checklist**: yes

| # | Dimension              | Score | Note |
|---|------------------------|-------|------|
| 1 | Frontmatter            | 5/5   | Valid; distinguishes from how-to/reference. |
| 2 | Description Quality    | 5/5   | Clear "newcomers, step-by-step linear path". |
| 3 | Conciseness            | 4/5   | Research questions (lines 39–71) thorough but slightly verbose. |
| 4 | Structure              | 5/5   | 361 lines + CHECKLIST.md is exemplary progressive disclosure. |
| 5 | Instruction Clarity    | 5/5   | 7 sequential steps, design template, narrative planning explicit. |
| 6 | Freedom Calibration    | 5/5   | Exact mdoc commands; flexible narrative arc; skill delegation appropriate. |
| 7 | Error Handling         | 4/5   | CHECKLIST.md mandates mdoc check; no symptom-to-cause table. |
| 8 | Progressive Disclosure | 5/5   | CHECKLIST.md loaded at end; skills referenced throughout. |
| 9 | Scripts Quality        | N/A   |  |
|10 | Completeness           | 5/5   | CHECKLIST.md has 30+ verification items. |

**Strengths**: CHECKLIST.md is the single best example of progressive disclosure in the repo; structural template (lines 78–110) is precise and learner-centric.

---

#### docs-mdoc-conventions — **47/50 (94.0 %)**

**Path**: `plugins/documentation/skills/docs-mdoc-conventions/SKILL.md`
**Lines**: 294 · **Scripts**: yes (`check-mdoc-conventions.sh`) · **References**: yes (`references/troubleshooting.md`) · **Checklist**: no

| # | Dimension              | Score | Note |
|---|------------------------|-------|------|
| 1 | Frontmatter            | 5/5   | Valid; describes shared-reference role. |
| 2 | Description Quality    | 5/5   | "When writing any documentation that contains Scala code blocks". |
| 3 | Conciseness            | 4/5   | Reference-style doc; necessary detail. |
| 4 | Structure              | 5/5   | Within limit; script + references/troubleshooting.md sibling. |
| 5 | Instruction Clarity    | 5/5   | Decision tree (lines 71–96) excellent. |
| 6 | Freedom Calibration    | 5/5   | Appropriately prescriptive; decision tree guides judgment. |
| 7 | Error Handling         | 4/5   | Troubleshooting reference comprehensive; SKILL.md only summarizes. |
| 8 | Progressive Disclosure | 5/5   | SKILL.md core → references/troubleshooting.md for deep errors → script for automation. |
| 9 | Scripts Quality        | 4/5   | Has usage, exit codes; output could be more structured. |
|10 | Completeness           | 5/5   | Modifiers, decision tree, patterns, tabs, admonitions, troubleshooting all covered. |

**Strengths**: poster child for the references/ + script + SKILL.md three-layer approach.
**Improvement**: structured (JSON) output from `check-mdoc-conventions.sh` would help downstream tooling.

---

#### docs-report-method-coverage — **47/50 (94.0 %)**

**Path**: `plugins/documentation/skills/docs-report-method-coverage/SKILL.md`
**Lines**: 14 · **Scripts**: yes (`check-method-coverage.sh`) · **References**: no · **Checklist**: no

| # | Dimension              | Score | Note |
|---|------------------------|-------|------|
| 1 | Frontmatter            | 5/5   | Valid. |
| 2 | Description Quality    | 5/5   | Clear: "check if documentation covers all public members". |
| 3 | Conciseness            | 5/5   | 14 lines; minimal payload. |
| 4 | Structure              | 5/5   | Minimal SKILL.md + bash script; right split. |
| 5 | Instruction Clarity    | 5/5   | Three-parameter invocation; stdin support documented. |
| 6 | Freedom Calibration    | 5/5   | Fully automated. |
| 7 | Error Handling         | 4/5   | Script has exit codes (0/1/2); SKILL.md doesn't document them. |
| 8 | Progressive Disclosure | 5/5   | Sized appropriately. |
| 9 | Scripts Quality        | 4/5   | 198 lines; modular extraction; exclusion list (`pred`, etc.) is heuristic; no `--help`. |
|10 | Completeness           | 4/5   | Doesn't explain how output should be used (manual vs CI gate). |

**Improvement**: add `--help`, document exit codes in SKILL.md, output JSON in addition to human-readable.

---

#### docs-skill-retrospection — **42/45 (93.3 %)**

**Path**: `plugins/documentation/skills/docs-skill-retrospection/SKILL.md`
**Lines**: 137 · **Scripts**: no · **References**: no · **Checklist**: no

| # | Dimension              | Score | Note |
|---|------------------------|-------|------|
| 1 | Frontmatter            | 5/5   | Valid. |
| 2 | Description Quality    | 4/5   | Could emphasize "improvement" more explicitly. |
| 3 | Conciseness            | 5/5   | Every sentence earns its keep; design notes justified. |
| 4 | Structure              | 5/5   | 6-step workflow + implementation notes; tight. |
| 5 | Instruction Clarity    | 5/5   | Deviation categories (Gap / Ambiguity / Wrong / Better) crystal clear. |
| 6 | Freedom Calibration    | 5/5   | "Don't restructure; don't add edge cases" — perfect calibration for a self-improvement skill. |
| 7 | Error Handling         | 4/5   | JSONL fallback for cross-session; sparse on skill-file-not-found. |
| 8 | Progressive Disclosure | 5/5   | Step 1 reads file; subsequent steps reference it. |
| 9 | Scripts Quality        | N/A   |  |
|10 | Completeness           | 4/5   | Doesn't address retrospections spanning multiple turns. |

**Strengths**: deviation categories are pragmatic; explicit exclusion of "contextual deviations" (line 74) prevents churn.

---

#### docs-verify-compliance — **42/45 (93.3 %)**

**Path**: `plugins/documentation/skills/docs-verify-compliance/SKILL.md`
**Lines**: 21 · **Scripts**: no · **References**: no · **Checklist**: no

| # | Dimension              | Score | Note |
|---|------------------------|-------|------|
| 1 | Frontmatter            | 5/5   | Valid. |
| 2 | Description Quality    | 5/5   | "Fix compliance issues; uses writing-style + mdoc-conventions". |
| 3 | Conciseness            | 5/5   | 21 lines; ultra-lean coordinator. |
| 4 | Structure              | 5/5   | Workflow + 3 sequential commands. |
| 5 | Instruction Clarity    | 5/5   | Commands explicit; sequence unambiguous. |
| 6 | Freedom Calibration    | 5/5   | Pure delegation. |
| 7 | Error Handling         | 3/5   | Assumes downstream commands always produce valid output. |
| 8 | Progressive Disclosure | 5/5   | Sized appropriately. |
| 9 | Scripts Quality        | N/A   |  |
|10 | Completeness           | 4/5   | Doesn't define `$ARGUMENTS`. |

**Improvement**: one sentence stating "if check-compliance reports new violations after a fix, return to step 1" would close the validation loop.

---

#### docs-data-type-list-members — **46/50 (92.0 %)**

**Path**: `plugins/documentation/skills/docs-data-type-list-members/SKILL.md`
**Lines**: 17 · **Scripts**: yes (`extract-members.scala`) · **References**: no · **Checklist**: no

| # | Dimension              | Score | Note |
|---|------------------------|-------|------|
| 1 | Frontmatter            | 5/5   | Valid. |
| 2 | Description Quality    | 5/5   | Trigger present ("for documentation completeness checks"). |
| 3 | Conciseness            | 5/5   | 17 lines; payload is the script invocation. |
| 4 | Structure              | 5/5   | Minimal SKILL.md + Scala script. |
| 5 | Instruction Clarity    | 5/5   | Optional type-name parameter documented. |
| 6 | Freedom Calibration    | 5/5   | Script does the work. |
| 7 | Error Handling         | 3/5   | Script has exit code 2 for "no methods"; SKILL.md doesn't document codes. |
| 8 | Progressive Disclosure | 5/5   | Appropriately sized. |
| 9 | Scripts Quality        | 4/5   | 192 lines, well-structured; no `--help`; output uses hardcoded `=== Public API ===` headers (brittle for downstream parsers). |
|10 | Completeness           | 4/5   | Doesn't explain the typical pipeline (output → check-method-coverage.sh). |

**Improvement**: add `--json` output mode; the downstream `check-method-coverage.sh` currently parses `=== ... ===` headers with regex — brittle.

---

#### docs-writing-style — **44/50 (88.0 %)**

**Path**: `plugins/documentation/skills/docs-writing-style/SKILL.md`
**Lines**: 123 · **Scripts**: yes (`check-docs-style.sh`) · **References**: no · **Checklist**: no

| # | Dimension              | Score | Note |
|---|------------------------|-------|------|
| 1 | Frontmatter            | 5/5   | Valid. |
| 2 | Description Quality    | 5/5   | "Prose style rules… ensure consistency". |
| 3 | Conciseness            | 4/5   | 25 rules + rationale dense; rules 8–9 both about qualification could merge. |
| 4 | Structure              | 5/5   | Rules grouped by topic; one SKILL.md + one script. |
| 5 | Instruction Clarity    | 5/5   | Bad-vs-Good examples throughout. |
| 6 | Freedom Calibration    | 5/5   | Mechanical rules in script; prose rules left to judgment; SAFE_NAMES escape hatch. |
| 7 | Error Handling         | 4/5   | Validates mechanically; no guidance on rule conflicts (Rule 2 vs 18 in same line). |
| 8 | Progressive Disclosure | 3/5   | All 25 rules inline; prose rules (1–7) could move to references. |
| 9 | Scripts Quality        | 4/5   | 446-line bash, modular per rule, Python fallback; Rule 13 lone-subheader detection has off-by-one risk. |
|10 | Completeness           | 4/5   | Script checks 15 of 25 rules; rest documented for human review. |

**Strengths**: exceptional Bad-vs-Good examples; clear pass/fail gate via exit code.
**Improvement**: split prose-only rules into `references/prose-rules.md`; SAFE_NAMES location should be explicit.

---

#### docs-critique — **39/45 (86.7 %)**

**Path**: `plugins/documentation/skills/docs-critique/SKILL.md`
**Lines**: 232 · **Scripts**: no · **References**: no · **Checklist**: no

| # | Dimension              | Score | Note |
|---|------------------------|-------|------|
| 1 | Frontmatter            | 5/5   | Valid. |
| 2 | Description Quality    | 5/5   | Clear "maker–critic loop". |
| 3 | Conciseness            | 4/5   | Phase 0 pre-flight could be tightened. |
| 4 | Structure              | 4/5   | 232 lines all in one file; sidebars.js logic inline. |
| 5 | Instruction Clarity    | 5/5   | 5-phase workflow; explicit DOC_PATH extraction; APPROVED/ITERATE branching. |
| 6 | Freedom Calibration    | 4/5   | Iteration rules explicit (3 rounds, severity-based). |
| 7 | Error Handling         | 5/5   | Best in the repo: explicit handling for agent failures, missing paths, unresolvable findings. |
| 8 | Progressive Disclosure | 3/5   | Sidebars.js parsing logic should be deferred. |
| 9 | Scripts Quality        | N/A   |  |
|10 | Completeness           | 4/5   | Minor: doesn't address skill-args with special characters. |

**Issues**:
1. [D5/D6] Line 96–97 says "MAY use Glob/Grep/Read" but the skill description elsewhere implies "never read files" — clarify.
2. [D10] `subagent_type: "docs-critic"` (line ≈141) is referenced but not defined — placeholder vs real subtype unclear.

---

#### docs-check-compliance — **39/45 (86.7 %)**

**Path**: `plugins/documentation/skills/docs-check-compliance/SKILL.md`
**Lines**: 115 · **Scripts**: no · **References**: no · **Checklist**: no

| # | Dimension              | Score | Note |
|---|------------------------|-------|------|
| 1 | Frontmatter            | 5/5   | Valid; argument-hint for two params. |
| 2 | Description Quality    | 5/5   | "Audit a doc file against a rule skill". |
| 3 | Conciseness            | 4/5   | Step 3 explanation slightly redundant (lines 48–66). |
| 4 | Structure              | 4/5   | All inline; mdoc compile detail (lines 73–82) could be reference. |
| 5 | Instruction Clarity    | 5/5   | Rule checklist creation (line 49); one commit per rule (line 61). |
| 6 | Freedom Calibration    | 4/5   | "MUST create comprehensive checklist" strong; minimal-edits rule good; commit strategy rigid. |
| 7 | Error Handling         | 5/5   | Adversarial verification ("assume compliance, prove violation") is excellent. |
| 8 | Progressive Disclosure | 3/5   | mdoc compilation could be deferred. |
| 9 | Scripts Quality        | N/A   |  |
|10 | Completeness           | 4/5   | Doesn't specify behavior if rule skill is malformed. |

**Issues**:
1. [D5] Line ≈29–32 uses pseudocode (`Skill: docs-writing-style`) — make literal Skill-tool syntax.
2. [D10] No fallback if rule skill returns no enumerated rules.

**Strength**: "assume compliance, then prove yourself wrong" (line 55) is a reusable verification heuristic.

---

#### docs-integrate — **39/45 (86.7 %)**

**Path**: `plugins/documentation/skills/docs-integrate/SKILL.md`
**Lines**: 58 · **Scripts**: no · **References**: no · **Checklist**: no

| # | Dimension              | Score | Note |
|---|------------------------|-------|------|
| 1 | Frontmatter            | 5/5   | Valid. |
| 2 | Description Quality    | 5/5   | Clear post-write checklist purpose. |
| 3 | Conciseness            | 5/5   | 58 lines; lean. |
| 4 | Structure              | 5/5   | 4 steps; tight. |
| 5 | Instruction Clarity    | 4/5   | Step 3 ("find existing pages that mention it") vague. |
| 6 | Freedom Calibration    | 4/5   | Step 4 mandatory mdoc gate. |
| 7 | Error Handling         | 3/5   | Step 4 mentions mdoc failure but no recovery target. |
| 8 | Progressive Disclosure | 5/5   | Sized appropriately. |
| 9 | Scripts Quality        | N/A   |  |
|10 | Completeness           | 3/5   | Code snippet for new Guide category (lines 18–29) appears incomplete. |

**Issues**:
1. [D10] Lines 18–29: missing closing brace in the sidebars.js example.
2. [D5] Step 3: define "enough" cross-references (1? 3? all? heuristic).

---

#### docs-data-type-ref — **39/45 (86.7 %)**

**Path**: `plugins/documentation/skills/docs-data-type-ref/SKILL.md`
**Lines**: 372 · **Scripts**: no · **References**: no · **Checklist**: no

| # | Dimension              | Score | Note |
|---|------------------------|-------|------|
| 1 | Frontmatter            | 5/5   | Valid. |
| 2 | Description Quality    | 5/5   | Distinguishes from `docs-module-ref`. |
| 3 | Conciseness            | 4/5   | SourceFile.print guidance (lines 282–296) verbose. |
| 4 | Structure              | 4/5   | 372 lines clean; SourceFile guidance could be external. |
| 5 | Instruction Clarity    | 5/5   | Template-based; examples for all sections. |
| 6 | Freedom Calibration    | 5/5   | Exact commands; flexible example depth. |
| 7 | Error Handling         | 3/5   | mdoc zero-errors stated; coverage validation (lines 313–325) referenced not looped. |
| 8 | Progressive Disclosure | 4/5   | Step 3 coverage check is good; integration deferred. |
| 9 | Scripts Quality        | N/A   |  |
|10 | Completeness           | 4/5   | Missing edge cases: sealed types with no public constructor, opaque types. |

**Issues**:
1. [D3/D4] Lines 282–296 (SourceFile.print): move to `references/embedding-examples.md`.
2. [D7] No validation loop for "did I document all public methods?" despite the coverage script existing.

**Recommendation**: ship a `CHECKLIST.md` like `docs-tutorial` does.

---

#### docs-research — **38/45 (84.4 %)**

**Path**: `plugins/documentation/skills/docs-research/SKILL.md`
**Lines**: 60 · **Scripts**: no · **References**: no · **Checklist**: no

| # | Dimension              | Score | Note |
|---|------------------------|-------|------|
| 1 | Frontmatter            | 5/5   | Valid. |
| 2 | Description Quality    | 5/5   | "Shared research procedure". |
| 3 | Conciseness            | 5/5   | 60 lines; lean; design rule sets scope. |
| 4 | Structure              | 5/5   | 4 steps; tight. |
| 5 | Instruction Clarity    | 4/5   | Step 1d's `sbt gh-query` (line 46) is undocumented. |
| 6 | Freedom Calibration    | 4/5   | Direction without rigid commands. |
| 7 | Error Handling         | 2/5   | No guidance if grep returns nothing or gh-query is missing. |
| 8 | Progressive Disclosure | 5/5   | Design rule (line 58) prevents scope creep. |
| 9 | Scripts Quality        | N/A   |  |
|10 | Completeness           | 3/5   | "Find real-world patterns" (line 37) lacks examples. |

**Issues**:
1. [D5] Line 46 `sbt "gh-query --verbose <topic>"` is non-standard sbt — link to where it's defined.
2. [D7] Add a fallback section for the most common "found nothing" case.

---

#### docs-examples — **38/45 (84.4 %)**

**Path**: `plugins/documentation/skills/docs-examples/SKILL.md`
**Lines**: 228 · **Scripts**: no · **References**: no · **Checklist**: no

| # | Dimension              | Score | Note |
|---|------------------------|-------|------|
| 1 | Frontmatter            | 5/5   | Valid. |
| 2 | Description Quality    | 5/5   | Lists consumer skills explicitly. |
| 3 | Conciseness            | 5/5   | 228 lines; no bloat. |
| 4 | Structure              | 5/5   | 7 steps; naming table; two doc variants (7a/7b). |
| 5 | Instruction Clarity    | 4/5   | Compilation failures glossed (line 94). |
| 6 | Freedom Calibration    | 4/5   | Templates allow customization; lint gate exact. |
| 7 | Error Handling         | 3/5   | "Fix any compilation failures" without enumerating common causes. |
| 8 | Progressive Disclosure | 4/5   | Natural progression. |
| 9 | Scripts Quality        | N/A   |  |
|10 | Completeness           | 3/5   | No coverage of: examples module doesn't exist; SourceFile.print dependency. |

**Issues**:
1. [D7] Line 94 compilation failures: enumerate top 3 causes (wrong imports, type errors, missing deps).
2. [D10] Missing: what if `<library>-examples` module doesn't exist yet? Suggest scaffolding step.

---

#### docs-add-missing-section — **37/45 (82.2 %)**

**Path**: `plugins/documentation/skills/docs-add-missing-section/SKILL.md`
**Lines**: 313 · **Scripts**: no · **References**: no · **Checklist**: no

| # | Dimension              | Score | Note |
|---|------------------------|-------|------|
| 1 | Frontmatter            | 5/5   | Valid. |
| 2 | Description Quality    | 5/5   | Clear trigger. |
| 3 | Conciseness            | 4/5   | Minor preamble (lines 12–18). |
| 4 | Structure              | 4/5   | Patterns embedded inline; could be `references/section-patterns.md`. |
| 5 | Instruction Clarity    | 5/5   | Section-type-specific patterns well-documented. |
| 6 | Freedom Calibration    | 4/5   | Balances exact commands and flexibility. |
| 7 | Error Handling         | 3/5   | Common Mistakes table (lines 275–288) is good but no recovery procedure. |
| 8 | Progressive Disclosure | 3/5   | Sub-skills referenced inline; could use "load X when Y" signals. |
| 9 | Scripts Quality        | N/A   |  |
|10 | Completeness           | 4/5   | Edge case missing: non-canonical heading order in target file. |

**Strengths**: Common Mistakes table (lines 275–288); Canonical Section Ordering (lines 20–34); section-type-specific patterns (lines 119–207).

---

#### docs-find-documentation-gaps — **41/50 (82.0 %)**

**Path**: `plugins/documentation/skills/docs-find-documentation-gaps/SKILL.md`
**Lines**: 115 · **Scripts**: yes (`scan-undocumented.sh`) · **References**: no · **Checklist**: no

| # | Dimension              | Score | Note |
|---|------------------------|-------|------|
| 1 | Frontmatter            | 5/5   | Valid. |
| 2 | Description Quality    | 5/5   | Trigger keyword present. |
| 3 | Conciseness            | 5/5   | 115 lines; concise. |
| 4 | Structure              | 4/5   | Could defer Step-2 (2a/2b/2c) prose to reference. |
| 5 | Instruction Clarity    | 4/5   | Step 2 (manual analysis) open-ended. |
| 6 | Freedom Calibration    | 4/5   | Script automated; Steps 2–3 require judgment. |
| 7 | Error Handling         | 3/5   | Silent on module-not-found. |
| 8 | Progressive Disclosure | 3/5   | Step 2 inline; could split. |
| 9 | Scripts Quality        | 4/5   | 285-line bash; idempotent (excludes own output); O(n²) grep loop is slow on large repos. |
|10 | Completeness           | 4/5   | Doesn't handle cross-module types or `$ARGUMENTS` substitution. |

**Issues**:
1. [D9] Script line 32 `xargs cat` breaks on filenames with spaces — use `-print0`/`-0`.
2. [D9] Script lines 97–99: usage count computed but only displayed for high-priority — inconsistent with report.

---

#### docs-module-ref — **35/45 (77.8 %)**

**Path**: `plugins/documentation/skills/docs-module-ref/SKILL.md`
**Lines**: 411 · **Scripts**: no · **References**: no · **Checklist**: no

| # | Dimension              | Score | Note |
|---|------------------------|-------|------|
| 1 | Frontmatter            | 5/5   | Valid. |
| 2 | Description Quality    | 5/5   | Distinguishes from `docs-data-type-ref`. |
| 3 | Conciseness            | 3/5   | "How They Work Together" repeated 5×; obvious concepts defined upfront. |
| 4 | Structure              | 4/5   | 411 lines clean; pattern examples inline. |
| 5 | Instruction Clarity    | 4/5   | Lines 52–61 vs 63 contradictory (describe tradeoffs heavily, then "don't recommend"). |
| 6 | Freedom Calibration    | 5/5   | Exact mdoc commands; flexible structure choice. |
| 7 | Error Handling         | 2/5   | Only mdoc zero-errors; missing validation for circular deps, module size. |
| 8 | Progressive Disclosure | 4/5   | Skills referenced; pattern examples could defer. |
| 9 | Scripts Quality        | N/A   |  |
|10 | Completeness           | 3/5   | Edge cases (circular deps, builder patterns) thin. |

**Issues**:
1. [D5] Lines 52–63: contradictory guidance (describes flat-vs-hierarchical tradeoffs, then "don't recommend"). Pick a stance.
2. [D3/D4] Lines 150–182: pattern examples 3× — move to `references/common-patterns.md`.
3. [D10] Add gotchas for builder pattern, circular module dependencies.

---

#### docs-document-pr — **34/45 (75.6 %)**

**Path**: `plugins/documentation/skills/docs-document-pr/SKILL.md`
**Lines**: 379 · **Scripts**: no · **References**: no · **Checklist**: no

| # | Dimension              | Score | Note |
|---|------------------------|-------|------|
| 1 | Frontmatter            | 5/5   | Valid. |
| 2 | Description Quality    | 5/5   | Delegation model clear. |
| 3 | Conciseness            | 2/5   | Phase-2 heuristics verbose; labels logic repeated 3×; example invocations ~50 lines bloat. |
| 4 | Structure              | 4/5   | Example invocations (lines 320–371) belong in `references/examples.md`. |
| 5 | Instruction Clarity    | 4/5   | Phase 2 dense (lines 88–103). |
| 6 | Freedom Calibration    | 5/5   | Exact gh commands; skill delegation. |
| 7 | Error Handling         | 2/5   | No PR-not-found or invalid-issue handling. |
| 8 | Progressive Disclosure | 4/5   | Skills deferred; examples too long inline. |
| 9 | Scripts Quality        | N/A   |  |
|10 | Completeness           | 3/5   | No coverage for docs-only PRs or deprecated-feature PRs. |

**Issues**:
1. [D3] Lines 73–104 (Phase 2 heuristics): consolidate into a single decision table.
2. [D3/D4] Lines 320–371: move example invocations to `references/example-invocations.md`.
3. [D7] Add error cases: PR not found, no related issues, ambiguous label set.

---

#### docs-how-to-guide — **34/45 (75.6 %)**

**Path**: `plugins/documentation/skills/docs-how-to-guide/SKILL.md`
**Lines**: 292 · **Scripts**: no · **References**: no · **Checklist**: yes

| # | Dimension              | Score | Note |
|---|------------------------|-------|------|
| 1 | Frontmatter            | 5/5   | Valid. |
| 2 | Description Quality    | 5/5   | "Goal-oriented guides". |
| 3 | Conciseness            | 3/5   | Lines 16–27 restate "what is a how-to guide"; line 13 has unfilled `$ARGUMENTS`; preamble too long. |
| 4 | Structure              | 4/5   | CHECKLIST.md sibling is good; Step 1 (75 lines) front-loads research. |
| 5 | Instruction Clarity    | 4/5   | Step 1e (lines 40–73) lists 20 research questions upfront. |
| 6 | Freedom Calibration    | 4/5   | Templates encourage customization. |
| 7 | Error Handling         | 2/5   | All error handling delegated to mdoc; no recovery in main skill. |
| 8 | Progressive Disclosure | 3/5   | Step 1's 20 questions should be in a reference, not the main file. |
| 9 | Scripts Quality        | N/A   |  |
|10 | Completeness           | 4/5   | CHECKLIST.md compensates; no inline Common Mistakes section. |

**Issues**:
1. [D3] Lines 16–27: trim restatement of "what a how-to guide is".
2. [D8] Lines 40–73: move 20 research questions to `references/research-questions.md` and gate them behind a "load when scoping the guide" trigger.
3. [D5] Line 13 `$ARGUMENTS` placeholder — unclear semantics; document or remove.

---

#### docs-organize-types — **34/45 (75.6 %)**

**Path**: `plugins/documentation/skills/docs-organize-types/SKILL.md`
**Lines**: 270 · **Scripts**: no · **References**: no · **Checklist**: no

| # | Dimension              | Score | Note |
|---|------------------------|-------|------|
| 1 | Frontmatter            | 5/5   | Valid. |
| 2 | Description Quality    | 5/5   | Two modes clear. |
| 3 | Conciseness            | 4/5   | Lines 11–50 duplicate workflow explanations. |
| 4 | Structure              | 4/5   | Implementation Notes (lines 254–270) could be reference. |
| 5 | Instruction Clarity    | 4/5   | Workflows clear; missing explicit error conditions. |
| 6 | Freedom Calibration    | 4/5   | Mode-2 confirmation step good. |
| 7 | Error Handling         | 2/5   | No guidance for duplicate categories, missing files, malformed sidebars.js. |
| 8 | Progressive Disclosure | 3/5   | Output Format (lines 223–250) should come earlier. |
| 9 | Scripts Quality        | N/A   |  |
|10 | Completeness           | 3/5   | "Type fits multiple categories" edge case unhandled. |

**Issues**:
1. [D3] Lines 11–50: trim mode descriptions; they're repeated below.
2. [D7] Add: "if sidebars.js fails JS syntax validation after edit, revert and report". Add: "if a type already lives in a category, skip silently".

---

### Plugin: `zio-skills`

#### zio-http-datastar — **42/45 (93.3 %)**

**Path**: `plugins/zio-skills/skills/zio-http-datastar/SKILL.md`
**Lines**: 360 · **Scripts**: no · **References**: yes (5 examples + `api-guide.md`)

| # | Dimension              | Score | Note |
|---|------------------------|-------|------|
| 1 | Frontmatter            | 5/5   | Description ~445 chars, well-formed. |
| 2 | Description Quality    | 5/5   | Strong trigger keywords (build, stream, sync, replace). |
| 3 | Conciseness            | 4/5   | Minor repetition in description (HTMX/AJAX/React). |
| 4 | Structure              | 5/5   | Within limit; 5 example files in `references/examples/`; api-guide.md for deep dive. |
| 5 | Instruction Clarity    | 5/5   | Sequential steps (1–4); "Critical mistake" warnings. |
| 6 | Freedom Calibration    | 4/5   | Pattern A (query params) lacks "when to prefer over body" guidance. |
| 7 | Error Handling         | 4/5   | Two ⚠️ inline warnings; no error table. |
| 8 | Progressive Disclosure | 5/5   | Clear signals to api-guide.md / ChatServer.scala. |
| 9 | Scripts Quality        | N/A   |  |
|10 | Completeness           | 5/5   | Streaming, signals, multi-client, patching modes all covered; Next-Steps section. |

**Strengths**: best-in-class progressive disclosure for the zio-skills plugin; concrete real-world example files.

---

#### zio-http-knowledge — **40/45 (88.9 %)**

**Path**: `plugins/zio-skills/skills/zio-http-knowledge/SKILL.md`
**Lines**: 61 · **Scripts**: no · **References**: no

| # | Dimension              | Score | Note |
|---|------------------------|-------|------|
| 1 | Frontmatter            | 5/5   | Valid. |
| 2 | Description Quality    | 5/5   | Comprehensive scope; "stop and consult" trigger. |
| 3 | Conciseness            | 5/5   | 61 lines; pure routing logic. |
| 4 | Structure              | 5/5   | Single document; minimal but appropriate. |
| 5 | Instruction Clarity    | 5/5   | Three-step workflow: identify → fetch sitemap → navigate. |
| 6 | Freedom Calibration    | 5/5   | Judgment-based; trusts the agent. |
| 7 | Error Handling         | 2/5   | No guidance on stale docs, offline fallback, deleted pages. |
| 8 | Progressive Disclosure | 5/5   | Single entry; escalation to official docs. |
| 9 | Scripts Quality        | N/A   |  |
|10 | Completeness           | 3/5   | No worked examples; no troubleshooting. |

**Issues**:
1. [D7/D10] Add a worked example (one Q&A trace) and a fallback for sitemap-fetch failure.

---

#### zio-http-scaffold — **39/45 (86.7 %)**

**Path**: `plugins/zio-skills/skills/zio-http-scaffold/SKILL.md`
**Lines**: 197 · **Scripts**: no · **References**: no

| # | Dimension              | Score | Note |
|---|------------------------|-------|------|
| 1 | Frontmatter            | 5/5   | Valid. |
| 2 | Description Quality    | 5/5   | Multiple trigger phrases ("scaffold", "hello world", "set up"). |
| 3 | Conciseness            | 5/5   | 197 lines; no bloat. |
| 4 | Structure              | 4/5   | URLs inline (lines 194–197); template2 has references/, this doesn't. |
| 5 | Instruction Clarity    | 5/5   | Server vs Client clearly distinguished; terminal output shown. |
| 6 | Freedom Calibration    | 5/5   | Defaults provided (Server.default, localhost:8080); Next Steps suggests deepening. |
| 7 | Error Handling         | 2/5   | No guidance on port conflicts, dependency resolution, common startup errors. |
| 8 | Progressive Disclosure | 5/5   | "Next Steps" section signals when to explore Endpoint API, middleware. |
| 9 | Scripts Quality        | N/A   |  |
|10 | Completeness           | 3/5   | No version compatibility, sbt-vs-Mill, or testing notes. |

**Issues**:
1. [D7] Add: "if the server fails to start with `Address in use`, change the port" — top 3 first-run failures.

---

#### zio-http-endpoint-to-openapi — **38/45 (84.4 %)**

**Path**: `plugins/zio-skills/skills/zio-http-endpoint-to-openapi/SKILL.md`
**Lines**: 292 · **Scripts**: no · **References**: no

| # | Dimension              | Score | Note |
|---|------------------------|-------|------|
| 1 | Frontmatter            | 5/5   | Valid. |
| 2 | Description Quality    | 5/5   | Clear scope (Endpoints → OpenAPI flow). |
| 3 | Conciseness            | 5/5   | Tight; assumes reader knows Endpoints. |
| 4 | Structure              | 5/5   | 292 lines, self-contained, logical flow. |
| 5 | Instruction Clarity    | 5/5   | Three sequential steps + full end-to-end example (lines 140–197). |
| 6 | Freedom Calibration    | 4/5   | Some template specificity around mount points. |
| 7 | Error Handling         | 2/5   | No coverage for OpenAPI generation failures or empty endpoint lists. |
| 8 | Progressive Disclosure | 4/5   | Self-contained file; no "load X when Y" signals. |
| 9 | Scripts Quality        | N/A   |  |
|10 | Completeness           | 3/5   | No edge cases (empty endpoint list, schema validation errors). |

**Issues**:
1. [D7/D10] Add a "Common Failures" section: missing schema for case class, no `description` on endpoints, conflicting paths.

---

#### zio-http-test — **41/50 (82.0 %)**

**Path**: `plugins/zio-skills/skills/zio-http-test/SKILL.md`
**Lines**: 775 · **Scripts**: yes (`validate-examples.sh`) · **References**: yes (`api-guide.md`, `assertions.md`, 8 example files)

| # | Dimension              | Score | Note |
|---|------------------------|-------|------|
| 1 | Frontmatter            | 5/5   | Valid; accurate scope. |
| 2 | Description Quality    | 5/5   | Clear triggers (write tests, validate, verify). |
| 3 | Conciseness            | 3/5   | Verbose tradeoff explanation (lines 26–32); Handler type re-explained. |
| 4 | Structure              | 4/5   | 775 lines justified by 3 levels but api-guide.md could be "load on demand" more aggressively. |
| 5 | Instruction Clarity    | 5/5   | Sequential; "Go to:" links (lines 34/47/60); progressive Level 1→3. |
| 6 | Freedom Calibration    | 5/5   | Recommends TestClient for most cases. |
| 7 | Error Handling         | 2/5   | Examples test errors but no systematic table or guidance section. |
| 8 | Progressive Disclosure | 5/5   | Explicit `references/examples/XX-title.scala` signals. |
| 9 | Scripts Quality        | 3/5   | `validate-examples.sh` only checks file presence; documents its own limitation (line 37: doesn't compile). |
|10 | Completeness           | 4/5   | WebSocket section is stubbed (line 588 marked "more advanced"). |

**Issues**:
1. [D7] Add an error table: failed assertions, missing TestEnvironment layers, async-test timeouts.
2. [D9] Make `validate-examples.sh` actually compile examples (the limitation noted at line 37).

---

#### zio-http-imperative-to-declarative — **36/45 (80.0 %)**

**Path**: `plugins/zio-skills/skills/zio-http-imperative-to-declarative/SKILL.md`
**Lines**: 388 · **Scripts**: no · **References**: no

| # | Dimension              | Score | Note |
|---|------------------------|-------|------|
| 1 | Frontmatter            | 5/5   | Valid. |
| 2 | Description Quality    | 5/5   | Clear refactoring trigger keywords. |
| 3 | Conciseness            | 3/5   | "Define" repeated (lines 68/97); Endpoint, Schema, .out re-explained. |
| 4 | Structure              | 4/5   | 388 lines; `BookEndpointExample.scala` and similar should be `references/examples/`. |
| 5 | Instruction Clarity    | 5/5   | Excellent side-by-side before/after (lines 217–265). |
| 6 | Freedom Calibration    | 4/5   | Steps prescriptive; advanced patterns (auth, headers) flexible. |
| 7 | Error Handling         | 3/5   | `.outError` mentioned but no error table. |
| 8 | Progressive Disclosure | 3/5   | Advanced patterns at end (line 277+); no "load X when Y" signals. |
| 9 | Scripts Quality        | N/A   |  |
|10 | Completeness           | 4/5   | Missing union types, auth fallbacks, "what about middleware?" |

**Issues**:
1. [D4] Move full Scala examples to `references/examples/`.
2. [D3] Trim re-explanation of Endpoint / Schema / .out — link to `zio-http-knowledge` or assume reader has it.
3. [D8] Surface "Advanced Patterns" earlier with conditional load signal.

---

#### zio-http-template2 — **36/45 (80.0 %)**

**Path**: `plugins/zio-skills/skills/zio-http-template2/SKILL.md`
**Lines**: 760 · **Scripts**: no · **References**: yes (`api-guide.md` + 6 examples)

| # | Dimension              | Score | Note |
|---|------------------------|-------|------|
| 1 | Frontmatter            | 5/5   | Valid; tags present. |
| 2 | Description Quality    | 5/5   | Distinguishes from string-interpolation HTML libraries. |
| 3 | Conciseness            | 3/5   | 760 lines; HTML element / attribute concepts repeated across Steps 2 + forms + components. |
| 4 | Structure              | 4/5   | references/ folder exists; bulk could move to api-guide.md. |
| 5 | Instruction Clarity    | 5/5   | Visual markers (⭐/✅/❌) for attribute-type distinctions. |
| 6 | Freedom Calibration    | 4/5   | Conditional class example (lines 500–503) is overly specific. |
| 7 | Error Handling         | 2/5   | Common mistakes inline (lines 150–157) but no error table. |
| 8 | Progressive Disclosure | 4/5   | references/ exists but mentioned only at end (lines 755–760); should signal "load api-guide.md before Step 1". |
| 9 | Scripts Quality        | N/A   |  |
|10 | Completeness           | 4/5   | Missing accessibility, performance (inline-style vs class) gotchas. |

**Issues**:
1. [D3/D4] Reduce repetition between Step 2 (attribute types) and forms / components sections — once is enough.
2. [D8] Move references/ load trigger earlier in SKILL.md ("for the full element list, load `references/api-guide.md`").
3. [D10] Add an Accessibility checklist for forms.

---

#### zio-http-openapi-to-endpoint — **34/45 (75.6 %)**

**Path**: `plugins/zio-skills/skills/zio-http-openapi-to-endpoint/SKILL.md`
**Lines**: 288 · **Scripts**: no · **References**: no

| # | Dimension              | Score | Note |
|---|------------------------|-------|------|
| 1 | Frontmatter            | 5/5   | Valid. |
| 2 | Description Quality    | 5/5   | Clear trigger keywords. |
| 3 | Conciseness            | 4/5   | 55-line OpenAPI JSON inline (lines 38–93). |
| 4 | Structure              | 3/5   | No references/; embedded OpenAPI JSON is structural bloat. |
| 5 | Instruction Clarity    | 5/5   | Sequential steps; bash commands clear. |
| 6 | Freedom Calibration    | 4/5   | Config table well-documented; flexible loading from file/URL. |
| 7 | Error Handling         | 3/5   | Troubleshooting section (line 260) covers 3 cases — good but isolated; no inline signals or validation loop. |
| 8 | Progressive Disclosure | 2/5   | Embedded JSON dominates first half; no "load X when Y" signals. |
| 9 | Scripts Quality        | N/A   |  |
|10 | Completeness           | 3/5   | Missing edge cases: nested $refs, discriminators, deprecated fields, format mappings. |

**Issues**:
1. [D4/D8] Move OpenAPI JSON example (lines 38–93) to `references/examples/petstore.json`.
2. [D7] Promote Troubleshooting from line 260 to inline signals near each step.
3. [D10] Add: behaviour on circular refs, $ref depth limits, polymorphic schemas.

---

## Cross-Cutting Recommendations (prioritized)

### High-priority (single change, broad impact)

1. **Add a "Common Failures" mini-section to every skill** (estimated 10–15 lines per skill).
   Format:
   ```
   ## Common Failures
   | Symptom                          | Likely cause                       | Fix                          |
   |----------------------------------|------------------------------------|------------------------------|
   | mdoc: "not found: value Chunk"   | Missing `import zio.blocks.chunk.*`| Add the import to the block  |
   ```
   Targets: every doc-authoring skill (`docs-data-type-ref`, `docs-module-ref`, `docs-add-missing-section`, `docs-document-pr`, `docs-how-to-guide`) and every zio-http skill.

2. **Adopt the `CHECKLIST.md` sibling pattern for all doc-authoring skills.** Currently only `docs-tutorial` and `docs-how-to-guide` have one. Add for: `docs-data-type-ref`, `docs-module-ref`, `docs-add-missing-section`, `docs-document-pr`, `docs-enrich-section`.

3. **Document exit codes and add `--help` to every helper script.** Five scripts need this: `check-docs-style.sh`, `check-mdoc-conventions.sh`, `check-method-coverage.sh`, `extract-members.scala`, `scan-undocumented.sh`.

### Medium-priority (specific skills)

4. **Move embedded examples and JSON blocks into `references/examples/`.**
   - `zio-http-openapi-to-endpoint`: lines 38–93 (OpenAPI JSON) → `references/examples/petstore.json`
   - `zio-http-imperative-to-declarative`: full Scala examples → `references/examples/`
   - `docs-document-pr`: lines 320–371 (example invocations) → `references/examples.md`
   - `docs-data-type-ref`: lines 282–296 (SourceFile.print guidance) → `references/embedding-examples.md`
   - `docs-add-missing-section`: section-type-specific patterns → `references/section-patterns.md`

5. **Resolve the `docs-module-ref` flat-vs-hierarchical contradiction** (lines 52–63 describe tradeoffs heavily, then line 63 says "don't recommend"). Pick a stance.

6. **Add structured (JSON) output mode to helper scripts** so downstream tools don't parse human-readable headers with regex. Affects `extract-members.scala` (currently produces `=== Public API ===` headers parsed by `check-method-coverage.sh`).

### Low-priority (polish)

7. **`docs-how-to-guide` line 13**: `$ARGUMENTS` placeholder unfilled. Either substitute or remove.

8. **`docs-integrate` lines 18–29**: complete the sidebars.js example (missing closing brace).

9. **`docs-research` line 46**: `sbt "gh-query --verbose <topic>"` references an undocumented sbt task — link to its definition.

10. **`docs-find-documentation-gaps/scan-undocumented.sh` line 32**: `xargs cat` breaks on filenames with spaces — use `-print0`/`-0`.

---

## Appendix: Score Matrix (all 28 skills, all 10 dimensions)

Cells marked `–` mean N/A (no scripts).

| Skill                                     | D1 | D2 | D3 | D4 | D5 | D6 | D7 | D8 | D9 | D10 | Total | %     |
|-------------------------------------------|----|----|----|----|----|----|----|----|----|-----|-------|-------|
| docs-enrich-section                       |  5 |  5 |  5 |  5 |  5 |  5 |  4 |  5 |  – |   5 | 44/45 | 97.8  |
| docs-tutorial                             |  5 |  5 |  4 |  5 |  5 |  5 |  4 |  5 |  – |   5 | 43/45 | 95.6  |
| docs-mdoc-conventions                     |  5 |  5 |  4 |  5 |  5 |  5 |  4 |  5 |  4 |   5 | 47/50 | 94.0  |
| docs-report-method-coverage               |  5 |  5 |  5 |  5 |  5 |  5 |  4 |  5 |  4 |   4 | 47/50 | 94.0  |
| docs-skill-retrospection                  |  5 |  4 |  5 |  5 |  5 |  5 |  4 |  5 |  – |   4 | 42/45 | 93.3  |
| docs-verify-compliance                    |  5 |  5 |  5 |  5 |  5 |  5 |  3 |  5 |  – |   4 | 42/45 | 93.3  |
| zio-http-datastar                         |  5 |  5 |  4 |  5 |  5 |  4 |  4 |  5 |  – |   5 | 42/45 | 93.3  |
| docs-data-type-list-members               |  5 |  5 |  5 |  5 |  5 |  5 |  3 |  5 |  4 |   4 | 46/50 | 92.0  |
| zio-http-knowledge                        |  5 |  5 |  5 |  5 |  5 |  5 |  2 |  5 |  – |   3 | 40/45 | 88.9  |
| docs-writing-style                        |  5 |  5 |  4 |  5 |  5 |  5 |  4 |  3 |  4 |   4 | 44/50 | 88.0  |
| zio-http-scaffold                         |  5 |  5 |  5 |  4 |  5 |  5 |  2 |  5 |  – |   3 | 39/45 | 86.7  |
| docs-critique                             |  5 |  5 |  4 |  4 |  5 |  4 |  5 |  3 |  – |   4 | 39/45 | 86.7  |
| docs-check-compliance                     |  5 |  5 |  4 |  4 |  5 |  4 |  5 |  3 |  – |   4 | 39/45 | 86.7  |
| docs-integrate                            |  5 |  5 |  5 |  5 |  4 |  4 |  3 |  5 |  – |   3 | 39/45 | 86.7  |
| docs-data-type-ref                        |  5 |  5 |  4 |  4 |  5 |  5 |  3 |  4 |  – |   4 | 39/45 | 86.7  |
| zio-http-endpoint-to-openapi              |  5 |  5 |  5 |  5 |  5 |  4 |  2 |  4 |  – |   3 | 38/45 | 84.4  |
| docs-research                             |  5 |  5 |  5 |  5 |  4 |  4 |  2 |  5 |  – |   3 | 38/45 | 84.4  |
| docs-examples                             |  5 |  5 |  5 |  5 |  4 |  4 |  3 |  4 |  – |   3 | 38/45 | 84.4  |
| docs-add-missing-section                  |  5 |  5 |  4 |  4 |  5 |  4 |  3 |  3 |  – |   4 | 37/45 | 82.2  |
| zio-http-test                             |  5 |  5 |  3 |  4 |  5 |  5 |  2 |  5 |  3 |   4 | 41/50 | 82.0  |
| docs-find-documentation-gaps              |  5 |  5 |  5 |  4 |  4 |  4 |  3 |  3 |  4 |   4 | 41/50 | 82.0  |
| zio-http-imperative-to-declarative        |  5 |  5 |  3 |  4 |  5 |  4 |  3 |  3 |  – |   4 | 36/45 | 80.0  |
| zio-http-template2                        |  5 |  5 |  3 |  4 |  5 |  4 |  2 |  4 |  – |   4 | 36/45 | 80.0  |
| docs-module-ref                           |  5 |  5 |  3 |  4 |  4 |  5 |  2 |  4 |  – |   3 | 35/45 | 77.8  |
| zio-http-openapi-to-endpoint              |  5 |  5 |  4 |  3 |  5 |  4 |  3 |  2 |  – |   3 | 34/45 | 75.6  |
| docs-document-pr                          |  5 |  5 |  2 |  4 |  4 |  5 |  2 |  4 |  – |   3 | 34/45 | 75.6  |
| docs-how-to-guide                         |  5 |  5 |  3 |  4 |  4 |  4 |  2 |  3 |  – |   4 | 34/45 | 75.6  |
| docs-organize-types                       |  5 |  5 |  4 |  4 |  4 |  4 |  2 |  3 |  – |   3 | 34/45 | 75.6  |

**Mean per dimension** (across all 28 skills):

| D1  | D2  | D3  | D4  | D5  | D6  | D7  | D8  | D9 (12 skills) | D10 |
|-----|-----|-----|-----|-----|-----|-----|-----|----------------|-----|
| 5.0 | 4.96| 4.07| 4.39| 4.71| 4.46| 3.04| 4.07| 3.83           | 3.79|

The two-dimension trough is unmistakable: **D7 (Error Handling) at 3.04** and **D10 (Completeness, mostly Common Mistakes / gotchas) at 3.79**. Closing those two gaps would lift the marketplace mean from 85.8 % into the low-90s.

---

*This report was produced by 6 parallel review agents, each scoring a subset of skills against the rubric. Per-dimension scores are reproduced verbatim from the agents; totals were recomputed independently for arithmetic consistency.*
