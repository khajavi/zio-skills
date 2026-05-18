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
allowed-tools: Read, Write, Glob, Grep, Bash(git:*), Bash(gh:*), Bash(jq:*)
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
    "42": { "status": "Not Documented", "checked_at": "2026-05-18T10:00:00Z" },
    "41": { "status": "Well Documented", "checked_at": "2026-05-18T10:00:00Z" }
  }
}
```

- `checked_prs`: map of PR number (string) → `{ status, checked_at }`

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

Fetch full PR details in a single call:

```bash
gh pr view <N> --repo <owner/repo> \
  --json number,title,body,labels,mergedAt,files,commits,author
```

Capture the output in a variable: `PR_DATA=$(gh pr view ...)`. This is used in Phase 4 to extract files and search for symbols.

Run Phase 3 (classification) and Phase 4 (grading) for this PR before advancing to the next.

---

## Phase 3 — Does This PR Require Documentation?

Evaluate signals to assign `REQUIRES_DOCS = yes | no | uncertain`.

### YES signals — any one is sufficient

| Signal | Description |
|--------|-------------|
| Label match | Labels contain any of: `feature`, `enhancement`, `new-feature`, `breaking-change`, `api-change`, `documentation-needed` |
| Title/body keywords | PR title or body contains (case-insensitive): "add", "introduce", "new", "API", "breaking", "deprecate" |
| Source files changed | Files changed include any `src/main/` path that is NOT under `test/`, `it/`, or `bench/` |
| Non-test Scala files | Files changed include any `.scala` file not matching `*Test.scala` or `*Spec.scala` |

### NO signals — skip only when ALL of these match

| Signal | Description |
|--------|-------------|
| Label match | Labels contain any of: `chore`, `ci`, `test`, `refactor`, `internal`, `dependencies` |
| Files match | Changed files consist only of: `*.yml`, `.github/**`, `*Test.scala`, `*Spec.scala`, `build.sbt`, `project/**` |
| Title prefix | Title starts with: `chore:`, `ci:`, `test:`, `bump`, `upgrade`, `update dependency` |

### UNCERTAIN

Any case not covered by YES or NO (mixed signals). Include these in the report with a ⚠️ note explaining the ambiguity.

---

## Phase 4 — Grade Documentation Coverage

Skip this phase entirely if `REQUIRES_DOCS = no`.

### Step 4a — Check for docs files in the PR

```bash
echo "$PR_DATA" | jq -r '.files[].path | select(startswith("docs/"))'
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

1. Add every processed PR to `checked_prs` with its documentation status and the current ISO 8601 timestamp.

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
- **Why docs needed:** <signal that triggered yes/uncertain>
- **Suggested action:** `/docs-document-pr <NNN>`

### 🟠 Stub
#### #NNN — <title>
- **Merged:** <date>
- **Labels:** <labels>
- **Why docs needed:** <reason>
- **Docs found:** <path to stub file>
- **Suggested action:** `/docs-enrich-section <path>`

### ⚠️ Uncertain (Requires Review)
#### #NNN — <title>
- **Merged:** <date>
- **Labels:** <labels>
- **Ambiguity:** <explanation of mixed signals>
- **Suggested action:** Review manually, then run `/docs-document-pr <NNN>` if needed

### 🟡 Partially Documented
#### #NNN — <title>
- **Merged:** <date>
- **Labels:** <labels>
- **Why docs needed:** <reason>
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
- [ ] **Phase 2:** Fetch full PR details with a single `gh pr view` call (all needed fields at once)
- [ ] **Phase 3:** Classify `REQUIRES_DOCS = yes | no | uncertain` using the YES/NO/UNCERTAIN signal tables
- [ ] **Phase 4:** Skip entirely if `REQUIRES_DOCS = no`
- [ ] **Phase 4:** Check `docs/` files changed in the PR via `jq`
- [ ] **Phase 4:** Extract key symbols; use the Grep tool to search for key symbols in `docs/`
- [ ] **Phase 4:** Assign rubric grade (Well Documented / Partially Documented / Stub / Not Documented)
- [ ] **Phase 5:** Write updated state to `.docs-audit-state.json` before generating the report
- [ ] **Phase 5:** Never remove existing entries from `checked_prs`
- [ ] **Phase 6:** Output formatted markdown report sorted by status severity then merge date
- [ ] **Phase 6:** Include uncertain PRs with a ⚠️ ambiguity note
- [ ] **Phase 6:** Ask user whether to continue with the next batch of 20

---

## Notes

- **Minimal API calls:** one `gh pr view` per PR — fetch all required fields (`number`, `title`, `body`, `labels`, `mergedAt`, `files`, `commits`, `author`) in a single call.
- **No `docs/` directory:** if the repo has no `docs/` tree, note this prominently at the start of the report and mark every docs-required PR as "Not Documented".
- **`--reset` flag:** clears all audit history so every PR is treated as new on the next run. Always confirm with the user before clearing.
- **State is local-only:** `.docs-audit-state.json` should not be committed. Remind the user to add it to `.gitignore`.
- **Suggested actions in report:** use `/docs-document-pr <NNN>` for Not Documented PRs and `/docs-enrich-section <path>` for Stub or Partially Documented ones — these map directly to other skills in this plugin.
