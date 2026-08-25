# Organizing Reference Docs

A reference section that has grown past a dozen pages becomes a flat list nobody can scan. This groups
those pages into categories: a category index page that says what the group is for, and a `sidebars.js`
entry that nests the pages under it.

**You move no files.** That is the rule the whole design rests on, and the reason is in the next
section.

## Why nothing moves

A page's links are relative to where it sits. Move `docs/reference/chunk.md` into
`docs/reference/collections/` and every `[Chunk](./chunk.md)` elsewhere in the tree breaks, every
`../` inside the page resolves one level wrong, and `onBrokenLinks: 'throw'` fails the build with a
list that does not say which move caused it.

So a category is a **sidebar grouping plus an index page**, not a directory. The pages stay where they
are and keep their ids. If a request asks for pages to be relocated, say that relocation is out of
bounds and offer the grouping instead.

Two failures follow from getting this wrong, and both have precedent in this repo:

- **A sidebar id for a path that does not exist.** The predecessor emitted ids as
  `reference/<category>/<type>` while moving nothing, so its entries pointed at files it never created.
  Derive every id from where the page actually is — `git ls-files` it or read it — never from the
  category name.
- **Creating a page so the build passes.** A sidebar entry pointing at a missing page is fixed by
  removing the entry, never by writing the page. A stub is unreviewed content that ships and takes the
  name the real page will want.

## Proposing the grouping

Read the pages. A category is a claim about what a group of types is *for*, and that comes from the
pages' own content — the opening definition of each, and its frontmatter `description` when it has one.

```bash
# the reference section's pages and their titles
git ls-files 'docs/reference/*.md' | while read -r f; do
  printf '%s\t%s\n' "$f" "$(sed -n 's/^title: *"\{0,1\}\([^"]*\)"\{0,1\}/\1/p' "$f" | head -1)"
done
```

Do **not** group by name substring. The predecessor's table matched "name contains chunk, list, vector"
→ Collections, which puts anything called `ChunkBuilder` in the wrong place and cannot see that two
differently-named types serve one purpose. Read what a page says the type is for.

Bounds on a proposal:

- **Three pages minimum per category.** A category of one or two is noise in the sidebar; leave those
  pages at the top level.
- **Every page keeps exactly one home.** A page in two categories is a sidebar bug — Docusaurus will
  render it twice and the second entry usually loses its label.
- **Leftovers stay at the top level, uncategorized.** Never invent a "Miscellaneous" category to
  achieve full coverage. Say in the receipt which pages you left ungrouped and why.
- **Name the category for the reader's concern, not the implementation.** ✅ `Resource Management`
  ❌ `Scope And Friends` ❌ `Core Types`

When the request names the category and its members, verify the grouping still satisfies those bounds
and say so if it does not — then follow the request.

## The category index page

One per category, at `docs/reference/<category-kebab>/index.md` **only if pages already live in that
directory**; otherwise at `docs/reference/<category-kebab>.md`. Frontmatter is the four-field contract
(`src/subagents/drafter.md` is authoritative), and the body is short:

- Two or three sentences on what this category covers and why these types are grouped — a reader
  should be able to tell whether their problem is in here.
- A list of the pages, each linking to where the page actually is, with a clause on what it does.
- No API, no examples, no duplicated prose from the pages themselves.

Apply the writing-style rules to it, as to any page — it is prose you are authoring, so rule 7's link
form governs and every link must resolve from the index's own directory.

## Editing `sidebars.js`

**Which file.** The git-tracked one, found with `git ls-files "*sidebars.js"` — never
`website/docs/sidebars.js`, which is mdoc output and gitignored, so an edit there ships nothing.

**The entry.** A category with a `link` to its index page and the pages as items:

```javascript
{
  type: 'category',
  label: 'Collections',
  link: { type: 'doc', id: 'reference/collections' },
  items: ['reference/chunk', 'reference/non-empty-chunk'],
}
```

Every id is the page's real path minus the extension. Alphabetical within `items`, and alphabetical
among categories in the section.

**Verify it still parses**, every time, before you go further:

```bash
node -e "require('./$(git ls-files '*sidebars.js' | head -1)')"
```

That catches a syntax error, which is what hand-editing usually breaks — but it is **not** proof the
sidebar loaded. A repo whose `package.json` sets `"type": "module"` makes a `.js` sidebar ESM, and
`require()` then returns `{}` for a file whose `module.exports` never took effect, with no error at all.
So never enumerate ids by requiring the file; read them out of the text, as the verification below does.

**Never delete an entry that is not yours to delete.** A page you did not group keeps its existing
entry exactly as it was. Removing a sibling's entry to tidy the file is the one edit here that loses
work nobody can see is missing.

## Verifying

In this order, because each catches something the next cannot:

1. `sidebars.js` parses — the command above.
2. Every id in the sidebar resolves to a page that exists. Text extraction, so it is unaffected by
   whether the file loads as CJS or ESM, and it covers both the `id:` form and a bare items string:
   ```bash
   grep -oE "(id|\"id\"): *['\"][^'\"]+['\"]|['\"](reference|guides)/[a-z0-9/-]+['\"]" docs/sidebars.js \
   | sed -E "s/.*['\"]([^'\"]+)['\"]$/\1/" | sort -u | while read -r id; do
       [ -f "docs/$id.md" ] || echo "MISSING docs/$id.md"
     done
   ```
   Any `MISSING` line is a broken entry. Remove the entry — never create the page to satisfy it.
3. Every link in each index page you wrote resolves from that page's directory.
4. The site build — `npm run build`, never `pnpm`. A broken link that survives steps 2 and 3 is
   usually a link on some *other* page that pointed at a page whose sidebar position changed; fix the
   link, and never by creating a file.

## The receipt

Per category: its name, its index page path, and the pages it now holds. Then the pages you left
ungrouped, with the reason. Then whether the build passed.

Say plainly when you propose no change. A reference section of eight pages does not need categories,
and saying so is a better answer than grouping for the sake of it.
