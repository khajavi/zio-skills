# The Critique-Fix Loop

A coordinator-only pattern for driving an existing documentation page (or a batch of them) to
approval through repeated critic-then-fixer rounds, capped at three, with severity governing how many
chances a finding gets.

## Roles

**Coordinator** (whoever mounts this skill) — never reads, writes, or edits the documentation file's
content directly. It only: resolves the target path(s), gathers context (file paths, not content) for
the critic, delegates to critic and fixer roles via `task`, parses verdicts, and reports. The one
exception: it may `Read` `sidebars.js` to find sibling page ids for the critic's context — that is
metadata about the site, not the page under review.

**Critic** — a fresh delegate per round (`task`, no persistent identity across rounds). Reads the
target page plus the source/test files and sibling docs the coordinator hands it, and reports findings
plus a verdict. Never edits.

**Fixer** — a fresh delegate per round. Reads the findings the coordinator hands it, edits the page,
commits, and reports what it fixed or what it could not.

Both are ordinary delegations, not a defined role under `src/subagents/` — a coordinator that mounts
this skill briefs each with the prompt shape below rather than pointing `task` at a named subagent.

## Phase 1 — Resolve the target

A file or a directory. For a directory, glob its `.md` files and — if there's more than a handful —
ask which to critique rather than processing all of them silently.

## Phase 2 — Gather critic context (paths, not content)

- **Source files**: from the doc path, derive the type name (`docs/reference/schema.md` → `Schema`)
  and glob for `**/<TypeName>.scala` and `**/<TypeName>{Spec,Test}.scala`.
- **Related docs**: prefer reading `sidebars.js` and taking the sibling ids in the same array as this
  page; fall back to globbing the parent directory (`docs/reference/*.md`, `docs/guides/*.md`) if the
  sidebar can't be parsed.

Collect these as two path lists — the coordinator hands paths to the critic, never contents.

## Phase 3 — Spawn the critic

Delegate with a prompt naming: the doc path to review, the source-file paths to verify accuracy
against, and the related-doc paths to check consistency against. Ask it to `Read` each itself, assess
technical accuracy, consistency with siblings, completeness, clarity and organization, and return:

```
### Findings
**<HIGH|MEDIUM|LOW>/<dimension>** — <title>
- Location: <file>:<line-range>
- Problem: <description>
- Impact: <why this matters>
- Suggestion: <how to fix>

### Verdict
APPROVED | ITERATE
```

If the response is missing either section, retry once with a fresh critic. A second malformed
response is reported to the requester, not silently retried again.

## Phase 4 — Triage

- `APPROVED` → done, report success.
- `ITERATE` with any HIGH or MEDIUM finding → Phase 5.
- `ITERATE` with only LOW findings → one fixer pass for the LOW items, no re-critique afterward. Done.

## Phase 5 — Fixer loop, capped at 3 rounds

**Severity rules**: HIGH findings keep coming back until fixed or round 3 is exhausted. MEDIUM
findings get exactly one shot — round 1 only; from round 2 on, only HIGH findings are sent forward.

Each round:

1. **Fix** — delegate to a fixer with the HIGH (+ MEDIUM on round 1 only) findings. It reads the page,
   edits it, and commits per finding: `docs(<file-stem>): fix <SEVERITY>/<dimension> — <description>`
   — combining findings that land in the same paragraph under the highest severity present. It reports
   what it fixed and what it could not.
2. **Re-critique** — a fresh critic, same prompt as Phase 3, with one addition: findings the fixer
   marked unresolvable are named explicitly and excluded from re-flagging (the coordinator already
   knows they exist).
3. **Parse** — `APPROVED` → done. `ITERATE` with only MEDIUM remaining → done, MEDIUM already had its
   round. `ITERATE` with HIGH remaining and round < 3 → next round. `ITERATE` at round 3 → report the
   remaining findings for a human to resolve; stop.

## Multiple files

Run Phases 2–5 per file, independently — a stuck file doesn't block the others. Report a summary table
(status, rounds used, findings fixed) plus aggregate totals across the batch.

## Reporting

Single file: name, final status, rounds needed, a one-line breakdown of findings fixed by severity,
and any unresolved issues. Multiple files: the summary table plus totals, and which files still have
open issues.
