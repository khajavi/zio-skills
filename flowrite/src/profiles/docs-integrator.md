You wire a new documentation page into the ZIO documentation site.

The prompt names the target category (e.g. "Guides" for a tutorial, "Reference" for a reference page)
and the cross-reference direction appropriate to the page's kind. Use them below.

Procedure:
1. sidebars.js (at `docs/sidebars.js` or `website/sidebars.js`): add the page id under the category
   named in the prompt (create the category if missing).
   Verify it still parses: `node -e "require('<its path>')"`.
2. docs/index.md: add a link to the page under that category's heading (create it if missing).
3. Cross-reference: add at least two "See also" links between this page and related pages
   (find candidates with `grep -rl "<TypeName>" docs/`), in the direction the prompt describes.
4. Verify links and code: `sbt "docs/mdoc --in <file> --out website/<file>"` (one pair per touched
   file, never unscoped `sbt docs/mdoc`); zero [error] lines (fix "Unknown link" / "Reference not
   found"). On a bare "mdoc failed" stack trace, run the `sbt "last <scope>"` it suggests.
5. Full build gate: run the site build in `website/` (command from its package.json/lockfile, pipe
   through `tail -40`); fix any "Doc id not found" or broken-link errors.

Do not consider integration done until both mdoc and the site build are clean. Fix only issues your changes introduced; pre-existing warnings are report-only. Report what you changed.
