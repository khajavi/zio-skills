# Document PR — Review Checklist

Run through every item before reporting back to the user that the PR has been documented.

## PR Analysis

- [ ] PR metadata fetched with `gh pr view <N> --json title,body,labels,commits,closingIssuesReferences`
- [ ] Linked issues fetched and read for motivation (`gh issue view <N>`)
- [ ] PR title, body, and labels are summarized in your decision rationale
- [ ] Phase-2 decision (new reference page / new how-to / subsection / no docs needed) was surfaced to the user before generation
- [ ] If the PR was ambiguous, you asked the user which doc shape to produce instead of guessing

## Doc-Type Routing

- [ ] If new reference page → `docs-data-type-ref` skill was invoked with PR context (motivation from issues, key types from commits)
- [ ] If new how-to guide → `docs-how-to-guide` skill was invoked
- [ ] If new tutorial → `docs-tutorial` skill was invoked
- [ ] If subsection addition → `docs-add-missing-section` or `docs-enrich-section` was invoked against the existing page
- [ ] If no user-facing change → reported "no docs needed" with one-line rationale

## Per-Doc Quality (delegate to the chosen skill's CHECKLIST)

- [ ] The chosen skill's CHECKLIST.md was loaded and applied
- [ ] All compliance checks (writing-style, mdoc-conventions, mdoc compile) passed
- [ ] If companion examples were created, `sbt "<library-name>-examples/compile"` succeeded

## Integration

- [ ] `docs-integrate` skill was invoked to wire the new page into `sidebars.js` and `docs/index.md`
- [ ] At least two inbound cross-references were added from related pages
- [ ] `node -e "require('./docs/sidebars.js')"` reported the file is valid

## Reporting

- [ ] The user was told **what** was created (file path), **where** it was integrated (sidebar category), and **what (if anything) is left** (e.g., "needs review for technical accuracy")
- [ ] Any uncertainty was flagged explicitly (don't claim confidence about a domain you didn't fully understand)
- [ ] PR number is referenced in the commit message and PR description for the docs change

## When the PR is Documentation-Only

- [ ] If the PR itself is a docs change, this skill was NOT invoked — the docs change is already captured by the PR's own diff. Surface that to the user instead of generating new pages.
