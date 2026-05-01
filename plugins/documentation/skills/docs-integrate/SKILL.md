---
name: docs-integrate
description: Shared integration checklist for new ZIO library documentation pages. Include after writing any new reference page or how-to guide to ensure it is wired into the site navigation.
allowed-tools: Read, Edit, Glob, Grep, Bash(git:*)
---

# Documentation Integration Checklist

After writing a new documentation page (reference page or how-to guide), complete these steps to
integrate it into the Docusaurus site.

## Step 1: Add to `sidebars.js`

Add the page's `id` to the sidebar in `docs/sidebars.js`. Place it in the appropriate category:

- **Reference pages**: add under the `"Reference"` category, maintaining alphabetical or logical
  order.
- **How-to guides**: add under the `"Guides"` category. If the category does not yet exist, append a new category entry to the top-level `sidebars.docs` array (next to `"Reference"`).

Example — a Guides category appended to an existing `sidebars.docs` array:

```javascript
// docs/sidebars.js
module.exports = {
  docs: [
    "index",
    {
      type: "category",
      label: "Reference",
      items: [
        "reference/chunk",
        "reference/schema",
        // ... existing reference pages
      ],
    },
    // 👇 NEW category, added by this step
    {
      type: "category",
      label: "Guides",
      items: [
        "guides/guide-id-here",
      ],
    },
  ],
};
```

After editing, verify the file still parses:

```bash
node -e "require('./docs/sidebars.js')" && echo "✓ sidebars.js is valid"
```

If `node` reports a syntax error (e.g., unmatched brace, trailing comma without ES2017 support), revert the edit and try again — Docusaurus will fail to start on a malformed sidebar.

## Step 2: Update `docs/index.md`

Add a link to the new page under the appropriate section in `docs/index.md`:

- Reference pages go under the "Reference Documentation" heading.
- Guides go under a "Guides" heading (create it if missing, after the reference section).

## Step 3: Cross-Reference Related Pages

Add links from related existing docs to the new page. Aim for **at least two** inbound cross-references — one isn't discoverable, three is plenty.

- For each data type or topic the new page covers, find existing documentation pages that mention it and add a "See also" link near the relevant section.
- If you wrote a guide that uses a specific type (e.g., `Schema`, `DynamicOptic`), add a cross-reference from the type's reference page to the guide.

Find candidate inbound pages with:

```bash
grep -rl "<TypeName or topic keyword>" docs/ | grep -v "<your-new-page-stem>.md"
```

## Step 4: Verify Compilation and Links (Mandatory Gate)

This is a **mandatory compilation gate**. All code examples in documentation are compile-checked via mdoc.

### Check Relative Links

Verify that all relative links in the new page and in any updated pages are correct:

- Internal links use relative paths: `[TypeName](./type-name.md)`.
- Anchor links match actual heading text (Docusaurus converts headings to lowercase kebab-case
  anchors).
- Run `sbt "docs/mdoc --in <path-to-new-page>"` to catch broken mdoc links (they appear as `[error] Unknown link '...'`).

### If mdoc Fails

If mdoc reports errors, do **not** commit. Return to the offending page, fix the reported lines, and re-run the same `sbt "docs/mdoc --in <path>"` command. Repeat until the run is clean. Common causes:

| Error                                | Likely cause                                            | Fix                                                         |
|--------------------------------------|---------------------------------------------------------|-------------------------------------------------------------|
| `Unknown link '/foo/bar.md'`         | Relative path is wrong or target was renamed            | Update the link to match the actual path under `docs/`      |
| `Reference '...' not found`          | Anchor doesn't match a heading                          | Use lowercase-kebab-case of the heading text                |
| `not found: value Foo`               | Code block is missing an `import` or a previous block   | Add the import or chain via `mdoc` (not `mdoc:reset`)       |
| `value foo is not a member of …`     | API drift since the page was written                    | Re-derive the example against current source                |
