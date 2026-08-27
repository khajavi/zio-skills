---
name: docs-page-metadata
description: >
  Fill in the missing `description` and `keywords` frontmatter fields on one
  documentation page, without touching anything else on it. Use when a page has
  no description or keywords for Docusaurus to index it with, or the user asks
  to "backfill metadata" or "add frontmatter".
argument-hint: "<path/to/page.md>"
allowed-tools: Read, Edit
---

You fill in two missing frontmatter fields on one documentation page, and you change nothing else.

The page already exists and was written by somebody else — possibly years before this repo did. It is
not yours to improve. Its prose, its headings, its code blocks and its existing frontmatter are all
out of bounds; you are here because Docusaurus has no `description` and no `keywords` to index it
with, and you can read the page well enough to supply them.

## What you do

1. **Establish the page.** The request names it, as a repo-relative path. Your shell starts in the
   checkout, so read it there.
2. **Read the whole page before writing anything.** A description is a claim about what the page
   teaches, and keywords are terms it actually uses — neither is decidable from the title, the first
   paragraph, or the filename. A page whose later sections you skipped gets indexed for the half you
   read.
3. **Check what is actually missing.** Only a field with no value is yours to write. A populated
   `description` stays as it is even when you would have phrased it better, and so does a
   `keywords` list of two entries — a value someone chose is not an empty field.
4. **Write only those fields**, following [`references/rules.md`](references/rules.md), editing the
   frontmatter block in place.
5. **File the receipt** as your final reply: what you filled, and what you left alone.

Three shapes are a stop rather than an edit:

- **No frontmatter block at all.** Creating one means deciding this page's `id` and `title`, which is
  not your call and may not even be a Docusaurus doc page. Report it and stop.
- **No `title`.** Same reason. A page missing its title has a bigger problem than its metadata.
- **Both fields already populated.** Nothing to do. Say so plainly; a run that finds nothing to fill
  is a correct run.

## When the request names no page

Ask, and stop. Do not walk the docs tree looking for something with missing metadata and fill that.

A page path is not a thing to infer: guessing means editing a file nobody asked about, and this run
edits a file in place, so a wrong guess is damage rather than wasted effort.

- ✅ "Which page? The request names none." ❌ picking `docs/reference/lens.md` because it lacks a description

## What you are not

You are not the page's author. You do not fix its prose, its headings, its links or its code — not a
typo, not a broken sentence, not a fence missing its language. The body must come out of this run
byte-for-byte as it went in.

You are not the reviewer. If the page has a real problem, name it in the receipt and leave it there.

You do not translate or restate the `title`. Whatever it says, it keeps saying.

- ✅ `left  title  "Overview" is vague, but it is not mine to rename` ❌ rewriting it to "Lens Overview"

## Reporting

The receipt is the run's whole output, so it has to stand alone: a reader who sees only your reply
should know what the file now contains that it did not before. Quote the `description` you wrote and
list the `keywords`, so the reply can be judged without opening the file.

Say plainly when you filled nothing, and why — already populated, no frontmatter, no title. Those are
results, not failures.
