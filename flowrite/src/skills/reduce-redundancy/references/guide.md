Redundancy makes a reader process the same thing twice. A page should say each thing once, in the
place a reader meets it first, and point back to that place afterwards.

Three kinds, in rising order of what they cost the reader and of how much judgment they take to fix.

| kind | what it is | example |
| --- | --- | --- |
| lexical | a word or phrase repeated where one serves | "return back"; the same three-word opener on two consecutive paragraphs |
| structural | a transition or signpost that guides nothing | "Furthermore,"; "As mentioned above," restating what was just said |
| semantic | a definition, motivation, or example given more than once | "`Ledger` is an immutable tally" in Overview, Use Cases, and above the API table |

Writing-style rule 3 already owns filler phrases ("as we can see", "it's worth noting that"). Fix
them when you meet them, but they are that rule's, not this guide's — and tutorial warmth
("Welcome!", "Let's", "notice that") is required tone there, not filler.

## Detecting

| signal | how to check |
| --- | --- |
| a definition stated more than once | grep the type name; a page defines it once, then refers to it |
| a motivation argued twice | the "why you want this" of the Overview reappearing in a later section's opening |
| a phrase repeated verbatim | `grep -c "<phrase>"` — three or more occurrences before it counts |
| a decorative transition | delete it and read the sentence; if nothing changed, it was decorative |
| a signpost restating its neighbour | "As we saw above, X is useful" directly after the passage that showed X |

Three occurrences, not two. A term recurring in two distant sections is a reader finding their place,
not repetition — and cutting it costs more than it saves.

## Fixing

| redundancy | fix |
| --- | --- |
| lexical: a redundant word | drop the word, keep the sentence |
| lexical: a phrase repeated nearby | keep the clearest occurrence, drop the rest |
| structural: decorative transition | delete it |
| structural: restated signpost | delete the signpost, keep the sentence it introduced |
| semantic: repeated definition | keep the FIRST occurrence; later ones become a link to it |
| semantic: repeated motivation | keep it where the reader meets the idea first |
| semantic: repeated example | leave it. Removing a code block is out of bounds — see below |

A repeated definition is replaced, never merely deleted: the later section still needs to name the
thing it is about.

- ✅ "See [`Ledger`](#ledger) for the full definition." ❌ deleting the sentence and leaving the section to start mid-thought
- ✅ delete "Furthermore," ❌ delete "because" — it carries the logic of the sentence

## Bounds

Over-cutting is the failure mode. Every bound below exists because breaking it damages a page that
was correct before you touched it.

**Never edit a code block.** Prose is the only target. mdoc blocks share one scope down the whole
page, so removing a "duplicate" example can break every block after it — and the compiler will blame
a line you never looked at. This is why the table above leaves repeated examples alone: the cost of
being wrong is a broken page, and the saving is a few lines a reader can skip.

- ✅ cut the sentence introducing the second of two similar examples ❌ cut the example
- ✅ leave two blocks that look alike ❌ merge them

**A cut removes words, never facts.** If the text you are about to delete carries information that
appears nowhere else on the page — a parameter, a default, a caveat, a version — it is not
redundancy, whatever it looks like.

**Never delete the last of anything.** The last example, the last definition, the last mention of a
member. A section reduced to a heading and a link is worse than a repetitive one.

**Transitions that carry logic stay.** "first", "then", "next", "because", "instead", "unless".
Sequence and causation are meaning; addition and emphasis usually are not.

**Leave the page valid.** Read every sentence you edited, in place, after editing it. A cut that
leaves a dangling "this" or a paragraph starting mid-argument has traded repetition for confusion.

**Headings, frontmatter, and links are not yours.** Structure belongs to the page's template and its
reviewer. Do not merge sections, renumber headings, or retitle anything to reduce repetition.

## The receipt

Report what you cut AND what you left. One line each, with the section name.

Leaving something is a finding: it says the guide was consulted and the bound held. A report that
lists only cuts cannot be told apart from a pass that never noticed the borderline cases.

```
cut       Overview          repeated definition of Ledger — now links to the first statement
cut       Core Operations   "Furthermore," (decorative)
left      Examples          two similar snippets — removing a code block is out of bounds
left      Overview          "because the tally is immutable" — carries the reason, not decoration
```
