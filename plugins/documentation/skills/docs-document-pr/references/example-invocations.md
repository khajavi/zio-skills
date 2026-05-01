# `docs-document-pr` — Example Invocations

Worked examples of the 6-phase workflow for representative PR shapes. Load this file when you need a concrete pattern for a new shape of PR (new feature, refinement to an existing concept, infra change, etc.).

---

## Example 1 — New Reference Page (new data-type / module)

**User:** "Document PR #1016 — Add XML support module"

**Workflow:**

1. Run `gh pr view 1016 --json title,body,labels,commits,closingIssuesReferences`.
2. Parse: `"feat(schema-xml): Add XML support module with schema-driven codec derivation"` + label `feat`.
3. Fetch linked issues for motivation.
4. **Decision (Phase 2):** New reference page (substantial feature, no existing XML doc).
5. **Invoke `docs-data-type-ref` skill** with:
   ```
   Create a reference page for the new Schema XML type from PR #1016.
   The PR introduces XML codec support.
   Key motivation: <from linked issues>.
   Key types: <from commits>.
   ```
6. Skill produces: `docs/reference/schema-xml.md`.
7. **Invoke `docs-integrate` skill** to add the page to `sidebars.js` and cross-reference it from related pages.
8. **Report:** "Created `docs/reference/schema-xml.md` and added it to the Reference sidebar."

---

## Example 2 — How-To Guide (teaches a technique)

**User:** "Document PR #1032 — Schema derivation improvements"

**Workflow:**

1. Fetch PR metadata.
2. **Decision (Phase 2):** New how-to guide — the PR teaches users a usage technique rather than introducing a new type.
3. **Invoke `docs-how-to-guide` skill** with:
   ```
   Create a how-to guide for deriving schemas using the Derivable type class.
   Source: PR #1032. Key example from commits: <extract minimal working example>.
   ```
4. Skill produces: `docs/guides/deriving-schemas.md`.
5. **Invoke `docs-integrate` skill**.
6. **Report:** "Created `docs/guides/deriving-schemas.md`."

---

## Example 3 — Subsection Addition (small refinement)

**User:** "Document PR #1138 — CI improvements"

**Workflow:**

1. Fetch PR metadata.
2. **Decision (Phase 2):** CI-only change. Two options:
   - If the project has a setup/contributor guide, append a subsection.
   - Otherwise, no user-facing docs are needed.
3. If a subsection is appropriate:
   - Find the existing page (e.g., `docs/guides/setup.md`).
   - Load **`docs-writing-style`** for prose rules.
   - Append a section like `## CI Configuration` summarizing the change.
   - Load **`docs-mdoc-conventions`** for any code-block formatting.
4. **Report:** Either "Added subsection to `docs/guides/setup.md`" or "This PR is a CI-only change; no user-facing docs needed."

---

## Example 4 — Bugfix With User-Visible Behaviour Change

**User:** "Document PR #1240 — Fix Chunk.flatten on nested empty chunks"

**Workflow:**

1. Fetch PR metadata. Look for `bug` / `fix` labels and the linked issue's reproduction case.
2. **Decision (Phase 2):** No new page — but the existing `docs/reference/chunk.md` should mention the corrected behaviour if it described the buggy behaviour.
3. Read `docs/reference/chunk.md` to find any text that documented the old (incorrect) behaviour.
4. If found:
   - **Invoke `docs-add-missing-section`** or `docs-enrich-section` to add a "Behaviour notes" subsection covering the corrected semantic.
5. If not (the page never claimed otherwise):
   - **Report:** "PR #1240 fixes a bug; the docs already match the intended behaviour. No update needed."

---

## Example 5 — Ambiguous PR

**User:** "Document PR #1399 — Add validation to Schema"

**Workflow:**

1. Fetch PR metadata. Read the PR body and the closing issue carefully.
2. **Decision (Phase 2):** Ambiguous — could be a new feature (reference page), a usage technique (how-to), or an enhancement to an existing type (subsection).
3. **Surface the ambiguity to the user** before generating anything:
   - "PR #1399 looks like it could be documented three ways: (a) new reference page for a `Validation` type, (b) a how-to on validating with Schema, or (c) a subsection on the existing `schema.md` page. Which do you prefer?"
4. After the user picks, follow the appropriate workflow above.

When in doubt, prefer **(c) subsection** — it is the lowest-cost option and easy to promote to its own page later if the topic grows.
