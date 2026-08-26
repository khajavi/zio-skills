---
name: docs-list-undocumented-prs
description: >
  Scans merged GitHub PRs (from latest commit back to an upstream base ref)
  and produces a documentation-coverage audit report. Processes 20 PRs per
  batch and asks before continuing to the next batch. Skips PRs already
  checked in previous runs using a persistent state file. For each new PR,
  determines whether documentation is required based on labels, changed files,
  and content signals, then checks whether docs exist and grades coverage using
  four rubric levels: Well Documented, Partially Documented, Stub, or Not
  Documented. Outputs a focused report showing only PRs that require docs,
  sorted by coverage gap severity. Use this skill whenever the user wants to
  know which merged PRs are missing documentation, wants a documentation debt
  audit, or asks "what needs to be documented?", "which PRs have no docs?",
  or similar coverage questions. Invoke it even if the user just says "doc
  audit" or "show me undocumented changes."
argument-hint: "[optional: base-ref or --reset, e.g. 'origin/main' or '--reset']"
allowed-tools: Read, Write, Glob, Grep, Bash(git:*), Bash(gh:*), Bash(jq:*), Bash(node:*)
triggers:
  - "doc audit"
  - "documentation audit"
  - "undocumented PRs"
  - "which PRs need docs"
  - "show me undocumented changes"
  - "what needs to be documented"
  - "docs coverage"
---

# Skill: docs-list-undocumented-prs

## Description

Scans merged GitHub PRs and produces a documentation-coverage audit report. For each PR, the skill determines whether docs are required, checks whether they exist, and grades coverage against a four-level rubric. Results are batched in groups of 20 with a persistent state file so that already-audited PRs are never re-processed.

**Trigger:** User says "doc audit", "documentation audit", "which PRs need docs", "show me undocumented changes", "what needs to be documented", "docs coverage", or similar phrasing.

---

## Phase 0 — Load Persistent State

Read `.docs-audit-state.json` from the repo root. Create the file if it does not exist.

**State file schema:**

```json
{
  "repo": "owner/repo",
  "checked_prs": {
    "42": {
      "title": "Add ZStream.throttle operator",
      "docs_required": "yes",
      "classification_gate": "YES-2",
      "classification_reason": "New public Scala file added: src/main/scala/zio/stream/ZStream.scala",
      "status": "Not Documented",
      "checked_at": "2026-05-19T10:00:00Z"
    },
    "41": {
      "title": "Fix HttpClient connection leak",
      "docs_required": "no",
      "classification_gate": "NO-7",
      "classification_reason": "Bug fix label with no new public files added",
      "status": null,
      "checked_at": "2026-05-19T10:00:00Z"
    }
  }
}
```

- `checked_prs`: map of PR number (string) → `{ title, docs_required, classification_gate, classification_reason, status, checked_at }`
  - `docs_required`: `"yes"` | `"no"` | `"uncertain"`
  - `classification_gate`: ID of the gate that fired (e.g., `"YES-2"`, `"NO-7"`, `"OVERRIDE-BREAKING"`, `"UNCERTAIN"`)
  - `classification_reason`: Human-readable one-line explanation of why the gate fired
  - `status`: Documentation rubric grade from Phase 4 (or `null` when `docs_required = "no"`)

**Initialization rules:**

- If the file does not exist, initialize it with:
  ```json
  { "repo": "<current-repo>", "checked_prs": {} }
  ```
- If the file exists but the `repo` field does not match the current repo, warn the user and ask whether to reset or abort.
- If `--reset` was passed as the argument, confirm with the user before clearing `checked_prs`.

**Gitignore reminder:** Remind the user to add `.docs-audit-state.json` to `.gitignore` if it is not already listed there.

---

## Phase 1 — Collect Next Batch of 20 Unchecked PRs

### Step 1a — Detect the repo

```bash
git remote -v
```

Parse `owner/repo` from the remote URL (handles both SSH and HTTPS formats).

### Step 1b — Fetch candidate PRs

Fetch 40 merged PRs to have room to filter already-checked ones:

```bash
gh pr list --state merged --limit 40 \
  --json number,title,labels,mergedAt \
  --repo <owner/repo>
```

If a base-ref argument was given (e.g., `origin/main`, `v1.0.0`), cross-reference with `git log`:

```bash
git log <base-ref>..HEAD --oneline --merges
```

Extract PR numbers from merge commit messages and restrict the `gh` results to those PRs.

### Step 1c — Filter and select

1. Remove PR numbers already present in `checked_prs`.
2. Take the first 20 remaining candidates (newest first).
3. Handle edge cases:
   - **0 unchecked remain:** Print "All recent PRs have been checked. Here's a cumulative summary:" followed by aggregated stats from `checked_prs`. Stop.
   - **1–19 unchecked remain:** Proceed with the available count and note it in the output.
   - **All 40 fetched are already checked:** Paginate — increase `--limit` (e.g., `--limit 80`, `--limit 120`, etc.) and repeat until 20 unchecked are found or the list is exhausted.

---

## Phase 2 — Process Each PR One by One

For each PR in the batch, print a progress line before processing:

```
> [N/20] Processing PR #<number>: <title>
```

Fetch full PR details in a single call (metadata):

```bash
gh pr view <N> --repo <owner/repo> \
  --json number,title,body,labels,mergedAt,commits,author
```

Then fetch file details with statuses (added/modified/deleted/renamed):

```bash
gh api repos/{owner}/{repo}/pulls/{N}/files --paginate \
  --jq '[.[] | {path: .filename, status: .status, additions: .additions, deletions: .deletions}]'
```

Combining both calls gives complete PR context with file-level status information.

Run Phase 3 (classification) and Phase 4 (grading) for this PR before advancing to the next.

---

## Phase 3 — Does This PR Require Documentation?

Run the bundled classifier instead of applying the gate table by hand — it is deterministic, and a
model evaluating ~16 ordered boolean conditions across a 20-PR batch is exactly where one gets
silently reordered or skipped, producing a wrong classification that still looks plausible:

```bash
echo '{"title": "<PR title>", "labels": [<label names>], "files": [{"path": "...", "status": "added|modified|removed|renamed"}, ...]}' \
  | node ${CLAUDE_PLUGIN_ROOT}/skills/docs-list-undocumented-prs/classify-pr-docs.mjs
```

Build the `files` array from the second `gh api` call in Phase 2 (it already has `path` and `status`
per entry — pass those two fields straight through). The script prints
`{"requiresDocs": "yes"|"no"|"uncertain", "gate": "<gate id>", "reason": "<why>"}`. Trust it; there is
nothing to re-derive by hand. Run with `--help` for the input/output shapes.

The tables below are **reference**, not a procedure to execute yourself — they document what the
script computes and why, so you can explain a classification or spot an actually-wrong gate (report
it, don't silently override it). First match wins, checked in this order: overrides, then NO-1
through NO-9, then YES-1 through YES-5, then UNCERTAIN.

### Preliminary Variable Extraction (computed by the script)

**File categories:**
- `files_test`: Paths matching `*Test.scala`, `*Spec.scala`, `*Suite.scala`, or under `src/test/`
- `files_main_scala`: `.scala` files under `src/main/`, excluding `files_test`
- `files_internal`: `files_main_scala` whose path contains `/internal/`, `/impl/`, or `/private/`
- `files_public_main`: `files_main_scala` minus `files_internal`
- `files_new_public_main`: `files_public_main` with file `status = added`
- `files_infra`: Paths matching `*.yml`, `*.yaml`, `.github/**`, `Dockerfile*`
- `files_build`: Paths matching `build.sbt`, `project/**`, `*.sbt`

**Title and label facts:**
- `cc_prefix`: Conventional commit type from title (e.g., `feat`, `fix`, `chore`, `refactor`, `test`, `ci`, `build`, `docs`, `perf`, `style`, `revert`) — extract if title matches `^(feat|fix|chore|refactor|test|ci|build|docs|perf|style|revert)(\(.+\))?!?:`
- `cc_breaking`: True if title contains `!:` (breaking change marker)
- `is_bump`: True if title matches (case-insensitive): `^(bump|upgrade|update).*\b(to v?\d|version|dep)` OR starts with `build(deps)`
- `is_revert`: True if title starts with `Revert "`

### Override Conditions (checked first)

| Override | Condition | Gate ID |
|----------|-----------|---------|
| Breaking change | `cc_breaking = true` | OVERRIDE-BREAKING |
| Docs explicitly needed | Labels include `documentation-needed` | OVERRIDE-DOCS-NEEDED |

### NO Gates (any single gate is sufficient to return NO; evaluated in order)

| Gate ID | Name | Condition | Rationale |
|---------|------|-----------|-----------|
| NO-1 | Dependency update | `is_bump = true` OR labels include `renovate` or `dependabot` OR (`cc_prefix = "build"` AND `files_main_scala` is empty) | Dependency version bumps never introduce user-facing API changes. Renovate and dependabot labels are definitive. |
| NO-2 | CI/infrastructure only | `files_public_main` is empty AND `files_infra ∪ files_build` is non-empty AND (labels include `ci`/`infrastructure` OR `cc_prefix = "ci"` OR `cc_prefix = "build"`) | Changes that touch only workflow files, Docker configs, build system metadata cannot affect public API. Requires corroboration from label or commit prefix. |
| NO-3 | Test-only changes | All changed files ⊆ (`files_test ∪ files_infra ∪ files_build`) AND `files_public_main` is empty | Changes that do not touch public source code require no documentation updates. |
| NO-4 | Conventional `fix:` without new public files | `cc_prefix = "fix"` AND `files_new_public_main` is empty | A `fix:` prefix signals a bug correction to existing behavior. If no new public files are added, existing documentation remains valid. |
| NO-5 | Conventional chore/refactor/test/ci/docs/style/perf/revert | `cc_prefix ∈ {chore, refactor, test, ci, docs, style, perf, revert}` AND `files_new_public_main` is empty | These conventional commit types signal maintenance, not API evolution. No new public files added means no new public surface. |
| NO-6 | Internal-only refactor | `files_public_main` is empty AND `files_internal` is non-empty AND (labels include `refactor` or `internal`) | Changes touching only internal packages (`*/internal/*`, `*/impl/*`, `*/private/*`) are implementation details not visible in public API documentation. Requires `refactor` or `internal` label for corroboration. |
| NO-7 | Bug fix label without new public files | Labels include `bug`, `fix`, or `bugfix` AND `files_new_public_main` is empty AND labels do NOT include any YES-gate labels (`feature`, `enhancement`, `api-change`, `breaking-change`) | Bug fix label combined with no new public files means existing behavior is corrected, not extended. |
| NO-8 | Chore label with no source changes | Labels include `chore` or `internal` AND `files_public_main` is empty | Chore label + no public source changes = metadata/config update requiring no documentation. |
| NO-9 | Revert commit | `is_revert = true` | Reverting a commit undoes changes already in the codebase. The original PR's documentation is no longer needed. |

### YES Gates (any single gate is sufficient to return YES; evaluated in order after NO gates fail)

| Gate ID | Name | Condition | Rationale |
|---------|------|-----------|-----------|
| YES-1 | Explicit feature commit | `cc_prefix = "feat"` | The conventional commit `feat:` type is the authoritative signal that new functionality was introduced. |
| YES-2 | New public source file added | `files_new_public_main` is non-empty | A `.scala` file added to `src/main/` outside of internal packages is an extension of the public API surface. |
| YES-3 | Breaking change label | Labels include `breaking-change` or `api-change` | Explicit breaking-change or api-change labels indicate API contract changes requiring documentation updates. |
| YES-4 | Feature/enhancement label with source changes | Labels include `feature`, `enhancement`, or `new-feature` AND `files_main_scala` is non-empty | Feature or enhancement labels combined with actual source changes indicate new or extended functionality. Requiring source changes prevents false positives from mislabeled chore PRs. |
| YES-5 | Public file modified with interface-change keywords | `files_public_main` is non-empty AND title contains (whole-word, case-insensitive match): `introduce`, `deprecate`, `breaking`, or `API` | Modification to public files combined with interface-change language suggests an API evolution requiring documentation. Whole-word matching prevents false positives like "add" in "added test" or "add CI". |

### UNCERTAIN — No Gate Matched

When no gate fires, the script returns `gate: "UNCERTAIN"` with a `reason` summarizing the observed
signals (commit prefix, labels, and file counts) — pass that reason straight into the report rather
than inventing your own explanation.

---

## Phase 4 — Grade Documentation Coverage

Skip this phase entirely if `REQUIRES_DOCS = no`.

### Step 4a — Check for docs files in the PR

```bash
gh pr view <N> --repo <owner/repo> --json files \
  | jq -r '.files[].path | select(startswith("docs/"))'
```

List any `docs/` paths that were modified or added in this PR.

### Step 4b — Extract key symbols and search docs

Extract 3–5 key symbols from the PR title, body, and commit messages:

- PascalCase type names (e.g., `ZStream`, `HttpClient`)
- camelCase method names (e.g., `throttle`, `mapZIO`)

For each symbol, search the docs tree:

Use the **Grep** tool to search for each symbol across the `docs/` directory (query: symbol name, path: `docs/`).

If `docs/` does not exist in the repo, skip this step and mark all docs-required PRs as "Not Documented". Note the absence at the start of the report.

### Step 4c — Assign documentation status

Apply the rubric below. Assign the highest level whose criteria are fully met.

| Status | Score | Criteria |
|--------|-------|----------|
| **Well Documented** ✅ | 3/3 | Dedicated doc page exists with working examples (mdoc blocks present), full API coverage, and cross-references to related features |
| **Partially Documented** 🟡 | 2/3 | Mentioned in docs but incomplete: missing code examples, partial API coverage, or no cross-references |
| **Stub** 🟠 | 1/3 | Doc file exists but is minimal — no examples, fewer than 15 meaningful content lines |
| **Not Documented** 🔴 | 0/3 | No docs found — key symbols absent from entire `docs/` tree |

---

## Phase 5 — Persist State

After processing all PRs in the batch, write the updated state to `.docs-audit-state.json` **before** generating the report.

1. For each processed PR, add an entry to `checked_prs` with:
   - `title`: PR title
   - `docs_required`: `"yes"` | `"no"` | `"uncertain"` (from Phase 3 classification)
   - `classification_gate`: Gate ID that fired (e.g., `"YES-2"`, `"NO-7"`, `"OVERRIDE-BREAKING"`, `"UNCERTAIN"`)
   - `classification_reason`: Human-readable reason (e.g., "New public Scala file added: src/main/scala/zio/Foo.scala")
   - `status`: Documentation rubric grade from Phase 4, or `null` if `docs_required = "no"` (Phase 4 skipped)
   - `checked_at`: Current ISO 8601 timestamp

Use the Write tool to update the file atomically.

**Never remove existing entries from `checked_prs`.**

---

## Phase 6 — Generate Report and Ask to Continue

Output a markdown-formatted report using the template below.

```markdown
# PR Documentation Audit — Batch N
Generated: <date>
Batch: PRs #<oldest>–#<newest> (<count> checked, <M> require documentation)
Total checked to date: <T> PRs across all runs

## This Batch Summary
| Status | Count |
|--------|-------|
| 🔴 Not Documented | N |
| 🟠 Stub | N |
| 🟡 Partially Documented | N |
| ✅ Well Documented | N |
| ⬜ Docs Not Required | N |

## PRs Requiring Documentation

### 🔴 Not Documented
#### #NNN — <title>
- **Merged:** <date>
- **Labels:** <labels or "none">
- **Why docs needed:** <classification_reason from state>
- **Suggested action:** `/docs-document-pr <NNN>`

### 🟠 Stub
#### #NNN — <title>
- **Merged:** <date>
- **Labels:** <labels>
- **Why docs needed:** <classification_reason from state>
- **Docs found:** <path to stub file>
- **Suggested action:** `/docs-enrich-section <path>`

### ⚠️ Uncertain (Requires Review)
#### #NNN — <title>
- **Merged:** <date>
- **Labels:** <labels>
- **Classification:** Gate ID <classification_gate>
- **Ambiguity:** <classification_reason from state>
- **Suggested action:** Review manually, then run `/docs-document-pr <NNN>` if needed

### 🟡 Partially Documented
#### #NNN — <title>
- **Merged:** <date>
- **Labels:** <labels>
- **Why docs needed:** <classification_reason from state>
- **Docs found:** <path(s) to existing doc files>
- **Suggested action:** `/docs-enrich-section <path>`

### ✅ Well Documented
#### #NNN — <title>
- **Merged:** <date>
- **Labels:** <labels>
- **Docs found:** <path(s)>

---
*PRs with no documentation requirement are excluded from this report.*
*State saved to `.docs-audit-state.json` — already-checked PRs will be skipped next run.*
```

**Sorting:** within each status group, list most-recently-merged PRs first.

**Uncertain PRs:** include in the detailed section with a ⚠️ note explaining the ambiguity (e.g., "Mixed signals: label is `refactor` but `src/main/` files were changed").

**After displaying the report**, if more unchecked PRs may exist, ask:

> "Processed N PRs in this batch. There may be more unchecked PRs. Continue with the next batch of up to 20?"

If the user confirms, loop back to Phase 1. If not, stop.

---

## Implementation Checklist

When you invoke this skill:

- [ ] **Phase 0:** Read `.docs-audit-state.json` (or initialize it if missing)
- [ ] **Phase 0:** Validate that `repo` in state matches current repo; warn and ask if mismatched
- [ ] **Phase 0:** Handle `--reset` argument with explicit user confirmation before clearing state
- [ ] **Phase 0:** Remind user to add `.docs-audit-state.json` to `.gitignore`
- [ ] **Phase 1:** Detect `owner/repo` from `git remote -v`
- [ ] **Phase 1:** Fetch 40 merged PRs via `gh pr list`, filter already-checked, take first 20
- [ ] **Phase 1:** Handle edge cases: 0 remaining (show cumulative summary), 1–19 remaining (proceed with count), all 40 checked (paginate)
- [ ] **Phase 2:** Print `[N/20] Processing PR #<number>: <title>` before each PR
- [ ] **Phase 2:** Fetch metadata via `gh pr view <N> --json number,title,body,labels,mergedAt,commits,author`
- [ ] **Phase 2:** Fetch file statuses via `gh api repos/{owner}/{repo}/pulls/{N}/files` to get `{path, status, additions, deletions}`
- [ ] **Phase 3:** Run `classify-pr-docs.mjs` with the PR's title, labels, and files — do not evaluate the gate table by hand
- [ ] **Phase 3:** Store the script's `gate` and `reason` alongside `docs_required` classification
- [ ] **Phase 4:** Skip entirely if `docs_required = "no"`
- [ ] **Phase 4:** Check `docs/` files changed in the PR via `jq`
- [ ] **Phase 4:** Extract key symbols; use the Grep tool to search for key symbols in `docs/`
- [ ] **Phase 4:** Assign rubric grade (Well Documented / Partially Documented / Stub / Not Documented)
- [ ] **Phase 5:** Write updated state to `.docs-audit-state.json` with `docs_required`, `classification_gate`, `classification_reason`, and `status`
- [ ] **Phase 5:** Set `status = null` for PRs where `docs_required = "no"`
- [ ] **Phase 5:** Never remove existing entries from `checked_prs`
- [ ] **Phase 6:** Output formatted markdown report sorted by status severity then merge date
- [ ] **Phase 6:** Include uncertain PRs with gate ID and classification reason
- [ ] **Phase 6:** Ask user whether to continue with the next batch of 20

---

## Notes

- **Two API calls per PR:** `gh pr view` for metadata + `gh api repos/{owner}/{repo}/pulls/{N}/files` for file statuses with added/modified/deleted distinction. The second call is necessary to distinguish newly added files (YES-2 gate) from modified files.
- **Hierarchical gate evaluation:** NO gates are evaluated first (any single match wins) before YES gates. This ensures dependency bumps and bug fixes are classified as NO quickly, avoiding expensive downstream checks.
- **Conventional commits:** The skill now recognizes commit type prefixes (`feat:`, `fix:`, `chore:`, etc.) as primary signals, with label matching as secondary corroboration. This aligns with common Git workflow conventions.
- **File path patterns for internal detection:** Paths containing `/internal/`, `/impl/`, or `/private/` are considered non-public. This is idiomatic in Scala/ZIO libraries to mark internal APIs.
- **State file enhancements:** Each `checked_prs` entry now includes `docs_required`, `classification_gate`, and `classification_reason` for full traceability. The `status` field is `null` for PRs classified as `docs_required = "no"` to signal Phase 4 was intentionally skipped.
- **No `docs/` directory:** if the repo has no `docs/` tree, note this prominently at the start of the report and mark every docs-required PR as "Not Documented".
- **`--reset` flag:** clears all audit history so every PR is treated as new on the next run. Always confirm with the user before clearing.
- **State is local-only:** `.docs-audit-state.json` should not be committed. Remind the user to add it to `.gitignore`.
- **Suggested actions in report:** use `/docs-document-pr <NNN>` for Not Documented PRs and `/docs-enrich-section <path>` for Stub or Partially Documented ones — these map directly to other skills in this plugin.
