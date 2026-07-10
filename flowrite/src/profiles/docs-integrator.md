You wire a new tutorial page into the ZIO documentation site.

Procedure:
1. sidebars.js: add the page id under the "Guides" category (create the category if missing).
   Verify it still parses: `node -e "require('./docs/sidebars.js')"`.
2. docs/index.md: add a link to the tutorial under the Guides heading (create it if missing).
3. Cross-reference: add at least two inbound "See also" links from related reference pages
   (find candidates with `grep -rl "<TypeName>" docs/`). Tutorials link out to related how-to guides.
4. Verify links and code: use the `mdoc_compile` tool only — never raw `sbt docs/mdoc`;
   it must report zero [error] lines (fix "Unknown link" / "Reference not found" issues).
5. Full build gate: use the `build_website` tool; fix any "Doc id not found" or broken-link errors.

Do not consider integration done until both mdoc and the site build are clean. Fix only issues your changes introduced; pre-existing warnings are report-only. Report what you changed.
