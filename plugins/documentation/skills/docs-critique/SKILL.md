---
name: docs-critique
description: >
  Critique and fix existing documentation files using an automatic review loop.
  Spawns critics to review docs and makers to fix issues. Iterates until approved
  or max 3 rounds. Handles single files or directories. Works with available tools.
argument-hint: "<doc-file-path-or-directory>"
allowed-tools: Agent, Bash, Glob, Grep, Read, Write, Edit, TaskCreate, TaskUpdate
---

# Documentation Critique Loop

## Arguments

`$ARGUMENTS` — The path to the existing documentation file to critique
(e.g., `docs/reference/schema.md`).

If `$ARGUMENTS` is empty, ask the user to provide the documentation file path
before proceeding.

Example invocation: `/docs-critique docs/reference/schema.md`

## Role

You are a **pure coordinator**. You NEVER read, write, or edit documentation files yourself. You ONLY:
1. Spawn agents
2. Pass messages between agents
3. Parse critic reports to decide next action
4. Report final status to the user

## Phase 1: Resolve Doc Path(s)

1. Use `$ARGUMENTS` directly as the doc path (file or directory).
2. If `$ARGUMENTS` is empty, ask the user to provide the documentation file path before proceeding.
3. Verify the path exists using `Bash/Glob`:
   - If it's a **file**: Process single file (go to Phase 2)
   - If it's a **directory**: Glob all `.md` files in the directory, ask user which file(s) to critique
   - If not found: Inform user and stop

**Example**: If user provides `docs/reference/codegen`, find all `.md` files in that directory:
```bash
find docs/reference/codegen -name "*.md" -type f | sort
```

Then ask: "Found 10 files. Critique all, or specific ones?"

## Phase 2: Gather Critic Context

Using the doc file path from Phase 1, gather context for the critic. You MAY use `Glob`, `Grep`, and `Read` for this phase only — this is the one exception to the "never read files" rule, because you need file paths (not content) to pass to the critic. Use `Read` only for `sidebars.js` to extract sibling page IDs.

1. **Source files** — Extract the type name from the doc path (e.g., `docs/reference/schema.md` → `Schema`). Find source files:
   ```
   Glob: **/<TypeName>.scala
   Grep: "class <TypeName>" or "trait <TypeName>" or "object <TypeName>"
   ```
   Also find test files:
   ```
   Glob: **/<TypeName>Spec.scala or **/<TypeName>Test.scala
   ```

2. **Related docs** — Find sibling pages using two methods:
   - **sidebars.js** (preferred): Read `sidebars.js` and find the array containing the doc's ID. Extract sibling page IDs from the same array. Map IDs to file paths.
   - **Fallback glob** (if sidebars.js parsing fails): Glob the parent directory:
     ```
     Glob: docs/reference/*.md (for reference pages)
     Glob: docs/guides/*.md (for guides)
     Glob: docs/tutorials/*.md (for tutorials)
     ```

3. Collect all found paths into two lists: `source_files` and `related_docs`.

## Phase 3: Spawn Critic Agent

Spawn a `general-purpose` agent as the critic to review the documentation:

```
Agent(
  description: "Critique documentation — Round N",
  subagent_type: "general-purpose",
  prompt: "You are a technical documentation reviewer for the ZIO project.
           Review the following documentation file for content quality,
           technical accuracy, completeness, and consistency.

           **Documentation file to review:**
           <doc-path>

           **Source files to verify accuracy against:**
           <list of source_files, one per line>

           **Related documentation to check consistency against:**
           <list of related_docs, one per line>

           **Your task:**
           Read each file using the Read tool. Analyze the documentation for:
           - Technical accuracy against source code
           - Consistency with related documentation
           - Completeness of explanations and examples
           - Clarity and organization

           **Required output format:**

           ### Findings

           (For each finding, use this format:
           **<SEVERITY>/<dimension>** — <title>
           - Location: <file>:<line-range>
           - Problem: <description>
           - Impact: <why this matters>
           - Suggestion: <how to fix>)

           ### Verdict
           One of: **APPROVED** or **ITERATE**

           (If ITERATE, list findings above. If APPROVED, explain why.)"
)
```

**Error handling:** If response lacks `### Findings` and `### Verdict` sections, retry once with fresh critic. If second attempt fails, report to user and stop.

## Phase 4: Triage & Decide Action

Parse the critic's `### Verdict` line:

- **`APPROVED`** → Report success to user. Done.
- **`ITERATE` with HIGH or MEDIUM findings** → Enter Phase 5 (Fixer Loop).
- **`ITERATE` with only LOW findings** → Spawn a general-purpose Fixer agent to fix LOW issues (single pass, no re-critique). Done after fixer responds.

Extract findings by severity and collect them for Phase 5 or for LOW-only pass.

## Phase 5: Fixer Loop

**Maximum 3 critique-fix cycles.** Track round number.

**Severity-based iteration rules:**
- **HIGH** findings: iterate until fixed (up to round 3)
- **MEDIUM** findings: iterate at most once — after round 1, only HIGH findings drive further cycles
- After round 1, only HIGH findings are sent to the fixer

### Each Round (1-3):

**Step A — Spawn Fixer Agent:**

Spawn a `general-purpose` Fixer agent with HIGH and MEDIUM findings (or just HIGH for round 2+):

```
Agent(
  description: "Fix documentation — Round N",
  subagent_type: "general-purpose",
  prompt: "You are a documentation fixer for the ZIO project.
           Documentation file: <doc-path>

           The documentation critic found the following issues that need fixing.
           [For round 1: Fix ALL HIGH and MEDIUM findings below]
           [For round 2+: Fix ALL HIGH findings below (MEDIUM had their one chance)]

           <paste HIGH/MEDIUM findings here>

           For each finding:
           1. Read the documentation file using the Read tool
           2. Make the fix in the file using the Edit tool
           3. Create a git commit for the fix using this format:
              docs(<file-stem>): fix <SEVERITY>/<dimension> — <description>
           4. If multiple findings affect the same paragraph, combine into one commit using highest severity

           After all fixes are done, respond: 'Fixes complete: <list fixes made>'

           If you cannot fix one or more findings, respond: 'Could not fix: <list unresolvable findings>'"
)
```

Wait for fixer to respond with completion status or unresolvable findings. If unresolvable, note them for exclusion from next critic cycle.

**Step B — Spawn Fresh Critic:**

Spawn a new `general-purpose` Critic agent (use same prompt as Phase 3, but append to it):

```
"The following findings were previously flagged but marked as unresolvable by the maker.
 Do NOT re-flag these in your report (we know they exist):
 <list unresolvable findings>"
```

**Step C — Parse Verdict:**

When the new critic responds, filter out unresolvable findings from the verdict before deciding next action:

- `APPROVED` → Report success to user. Done.
- `ITERATE` with only MEDIUM findings remaining → Done (MEDIUM had its one iteration).
- `ITERATE` with HIGH findings and round < 3 → Go to next round (Step A).
- `ITERATE` and round = 3 → Report remaining issues to user with instructions to review manually.

## Phase 6: Multiple Files (if applicable)

If the user provided a directory in Phase 1 and selected multiple files:

For each file in the list:
1. Go through Phases 2–5 (critique and fix loop)
2. Track results per file in a summary table
3. After all files are processed, report aggregate results

## Output

When done, report to the user:

**For single file:**
- File name
- Status: APPROVED or remaining issues
- Rounds needed (if any)
- Summary of findings fixed (e.g., "2 HIGH fixed, 1 MEDIUM fixed, 3 LOW fixed")
- Any unresolvable issues (if applicable)

**For multiple files:**
- Table of results by file (Status, Rounds, Findings Fixed)
- Total counts across all files
- List of files with unresolved issues
