# Cross-Linking Guide

You make ONE page reachable. The page exists and is finished; what it lacks is anything pointing at
it. Your job is to find the pages that should mention it and add one prose link from each.

The direction matters and is easy to get backwards. You are not reading a page and linking out to
whatever it mentions — that enriches the pages that are already easy to find. You are taking a page
nobody links to and giving it inbound links.

## Measuring inbound links

These commands answer "is this page reachable?" from the files themselves. Run them from the repo
root, with the docs directory as given in your task.

**Is anything linking to the target?** A link's path is relative to the page it sits in, so a hit has
to be resolved against the *source* page's directory before it can be compared:

```bash
target="docs/reference/stm/tref.md"
grep -rIn --include='*.md' --include='*.mdx' -oE '\]\([^)]+\.mdx?(#[^)]*)?\)' docs \
| sed -E 's/^([^:]+):[0-9]+:\]\(([^)#]+).*/\1 \2/' \
| while read -r src href; do
    case "$href" in http*|/*) continue ;; esac
    [ "$(realpath -m --relative-to=. "$(dirname "$src")/$href")" = "$target" ] && echo "$src"
  done | sort -u
```

Do not shortcut this to a basename grep. `index.md` exists in many directories, so matching the
filename alone reports links that point somewhere else entirely. Resolving the path is the step the
original implementation skipped, and its orphan report was wrong as a result.

**An index link is not discoverability.** A section index lists every page beneath it, so almost no
page has zero inbound links — and counting those hides the problem. Split them:

```bash
# every inbound link in the tree, tagged IDX when the source is an index page, PRO otherwise
grep -rIn --include='*.md' --include='*.mdx' -oE '\]\([^)]+\.mdx?(#[^)]*)?\)' docs \
| sed -E 's/^([^:]+):[0-9]+:\]\(([^)#]+).*/\1 \2/' \
| while read -r src href; do
    case "$href" in http*|/*) continue ;; esac
    t="$(realpath -m --relative-to=. "$(dirname "$src")/$href")"
    [ "$t" = "$src" ] && continue
    case "$(basename "$src")" in index.md|index.mdx) echo "IDX $t" ;; *) echo "PRO $t" ;; esac
  done | sort -u
```

A page with `IDX` lines and no `PRO` lines is the case worth fixing: it is in the sidebar and nothing
in the prose ever sends a reader there. Treat "no `PRO` inbound" as the definition of an orphan, and
say in the receipt when the target already had index links.

**Finding candidate sources.** The pages that ought to link to the target are the ones already talking
about its subject:

```bash
grep -rIln --include='*.md' --include='*.mdx' -F "TypeName" docs
```

Read each candidate before editing it. A page that mentions the name once inside a code example is not
a candidate; a page that explains a related concept in prose is.

**Read to a budget, not exhaustively.** Candidate sets on a real tree are far larger than they look:
`TRef` has 6 pages, `Promise` 24, `Task` 45, `ZLayer` 63 — and `ZLayer`'s 63 pages are ~186k tokens,
which is most of a context window spent on one target. So:

- Rank candidates by how many times they mention the subject (`grep -c`), and read the densest first.
- Read in full only as many as you can act on — a handful. Three good links beat ten speculative ones,
  so there is no value in reading the twentieth candidate.
- For a page over about 40 KB, read the region around the match rather than the whole file. One page in
  the real tree, `docs/guides/migrate/migration-guide.md`, is 112 KB and is a candidate for nearly
  every subject.
- Stop reading a target's candidates once you have the links you intend to add.

## Where a link may sit, and where it may not

Every rule here is a failure that shipped or nearly shipped. The first one is the reason this guide
exists.

**Never put a link inside an inline-code span.** It renders as literal text, and nothing catches it —
not `mdoc`, because it is not a fenced block; not the site build, because it is not a link:

- ❌ ``return a `[URIO](../core/zio/urio.md)[Random, T]` value`` — the link is inside the backticks
- ✅ ``return a [`URIO`](../core/zio/urio.md)`[Random, T]` value`` — the link wraps the backticked word

The ❌ form is a real line that reached a published documentation site and stayed there. The
difference is one character of position, so check every edit you make against these two shapes.

**Never link inside a fenced block, of any fence length**, and never inside frontmatter. A link in a
`scala mdoc` block breaks the compile; a link in a ` ````scala mdoc:passthrough ` block breaks it in a
way that is harder to read; a link in frontmatter corrupts the page's metadata.

- ❌ a link anywhere between a line starting with ``` (or ~~~, or four or more backticks) and its close
- ❌ a link between the opening `---` and closing `---` of the frontmatter block

**Never link inside another link.** An image inside a link is legitimate (`[![badge](svg)](url)`); a
second `[text](path)` inside the brackets of the first is not.

**Never put a link in a heading.** A heading's text becomes the page's anchor, so editing one silently
breaks any link elsewhere that targeted it, and nothing reports the break.

**Never edit code to create a link opportunity.** If the target's name appears only inside code blocks
and headings on every candidate page, add nothing and say so in the receipt. A run that reports "no
suitable prose mention" is a correct run.

## Anchor text

- One to three words. The shortest phrase that names the concept.
- Match the page's own capitalisation exactly, and link a complete word: the classic failure is `Ref`
  matching inside `careful`.
- Prefer the first prose mention on the page. Later mentions may stay unlinked.
- Never let the anchor drift wider than the concept:
  - ✅ ``[`URIO`](../core/zio/urio.md)`` — the type name
  - ❌ a link on the bare word `value`, taken from a phrase like "models an `IO` value"

The second is what happens when an anchor is chosen as a long phrase and then trimmed to whatever
matched. Choose the short form to begin with.

## Bounds

- **One link per source page, across the whole run.** If a page discusses the target in three places,
  link the first. And when a page is a candidate for two targets in the same run, it still gets **one**
  link — not one per target. This is the bound that keeps a batch from doing what a repeated sweep
  does: measured on three real orphans, their candidate sets overlapped on three pages, and
  `docs/guides/migrate/migration-guide.md` was a candidate for all three. The corpus norm for a
  non-index page is seven internal links or fewer; a run that adds one per target per page walks past
  that in a handful of invocations, and nothing in the files records the total.
- **Whole pages only.** Never `file.md#heading` — an anchor is only ever checked by a full site build,
  so a wrong one is invisible until much later.
- **Link form is writing-style rule 7**, which governs relative path and full `.md` filename. That
  rule is the spec; follow it rather than restating it, including its repair: a link whose target does
  not exist is dropped, never made to resolve by creating the target.
- **Never create a page.** The target already exists — that is the premise of the task. If a candidate
  link would point at something absent, drop that link.
- **Never rewrite the sentence you are linking.** Wrap an existing phrase. You are not improving the
  prose on these pages; you are making one page findable from them.
- **Three good links beat ten speculative ones.** There is no number to reach. A page that genuinely
  belongs in two other pages' prose gets two links.

## Verifying before you report

For every page you edited:

```bash
# 1. the inserted path resolves from the page it sits in
( cd "$(dirname "$src")" && test -f "$href" && echo "ok $src -> $href" || echo "BROKEN $src -> $href" )

# 2. no link ended up inside an inline-code span — expect no output
grep -nE '`\[[^]]*\]\([^)]+\)' "$src"

# 3. no link ended up inside another link — expect no output
grep -nE '\[[^]]*\[[^]]*\]\([^)]+\)[^]]*\]\(' "$src"

# 4. the target is now reachable from prose — rerun the PRO/IDX recipe above
```

Check 3 exists because a batch is what makes it reachable: two targets' anchors on the same page can
nest, and check 2 is blind to it. One shape is legitimate and will match — an image inside a link,
`[![badge](svg.svg)](url)`. Anything else is a defect.

Then re-run the inbound check on the target. If it still shows no `PRO` line, your edits did not
achieve the task, and the receipt has to say that rather than claim success.

**Once, at the end of the run**, confirm every line you added names a target you were asked about:

```bash
git diff -U0 -- docs | grep '^+' | grep -v '^+++' | grep -vF -e 'tref.md' -e 'tmap.md'   # your targets
```

Expect no output. This replaces the check a single-target run gets for free — there, every added line
contains the one target's path, and a one-token grep audits the whole diff. With several targets that
becomes several alternatives, so it has to be run deliberately. It is the only mechanical audit of this
run's output that exists: nothing downstream re-checks the work, and the run report cannot see which
pages were edited, because this agent edits rather than writes.

## Working a batch

The request may name several targets. Nothing else about the task changes — each target is handled
exactly as one target is — but four rules only exist because of batches, and they are all above:

- read candidates **to a budget**, since one large subject can fill the context alone
- **one link per source page across the run**, not per target
- **check for nested links** after each target, not only inline-code spans
- **audit the whole diff once at the end** against the declared targets

Handle targets one at a time, in the order the instructions give (densest subject first), and finish
each one's receipt block before starting the next. Never widen a batch beyond what the request named,
and never continue after a verification grep fails — the same instruction produced that edit, so the
next target would produce it again.

## The receipt

The run's whole output. For each source page: the path, the anchor text you wrapped, and the section it
sits in. Then every candidate you read and deliberately left alone, with the reason — "mentions the
type only inside a code block" is the most common and the most useful to record.

Say plainly when you added nothing. A target whose subject genuinely appears nowhere in prose is a
real result, and it is more useful than a link forced into a page that was not about the subject.
